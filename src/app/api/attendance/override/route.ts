import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Verify caller is an instructor (NOT admin)
        const { data: actor } = await supabase
            .from("instructors")
            .select("id, role")
            .eq("id", profileId)
            .single();

        if (!actor || actor.role !== "instructor") {
            return NextResponse.json({ error: "Forbidden: Instructors only" }, { status: 403 });
        }

        const { student_id, class_id, date, new_status } = await request.json();

        if (!student_id || !class_id || !date || !new_status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const validStatuses = ["Present", "Late", "Absent"];
        if (!validStatuses.includes(new_status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
        }

        // Verify this class belongs to the instructor
        const { data: classData } = await supabase
            .from("classes")
            .select("id, instructor_id")
            .eq("id", class_id)
            .eq("instructor_id", profileId)
            .single();

        if (!classData) {
            return NextResponse.json({ error: "Class not found or does not belong to you" }, { status: 403 });
        }

        // Find the attendance log for this student + class + date
        const dayStart = new Date(`${date}T00:00:00+08:00`).toISOString();
        const dayEnd = new Date(`${date}T23:59:59+08:00`).toISOString();

        const { data: existingLog } = await supabase
            .from("attendance_logs")
            .select("id")
            .eq("student_id", student_id)
            .eq("class_id", class_id)
            .gte("timestamp", dayStart)
            .lte("timestamp", dayEnd)
            .order("timestamp", { ascending: false })
            .limit(1)
            .single();

        if (existingLog) {
            // Update existing log
            const { error: updateError } = await supabase
                .from("attendance_logs")
                .update({ status: new_status })
                .eq("id", existingLog.id);

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        } else {
            // Create a new log entry for manual override (e.g., marking absent student as present)
            const { error: insertError } = await supabase
                .from("attendance_logs")
                .insert({
                    student_id: parseInt(student_id),
                    class_id,
                    timestamp: new Date(`${date}T08:00:00+08:00`).toISOString(),
                    status: new_status,
                });

            if (insertError) {
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
        }

        // Audit log
        await supabase.from("audit_logs").insert({
            actor_id: profileId,
            action: "attendance_override",
            target_type: "student",
            target_id: String(student_id),
            details: { class_id, date, new_status },
        });

        return NextResponse.json({ success: true, status: new_status });
    } catch (err) {
        console.error("Attendance override error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
