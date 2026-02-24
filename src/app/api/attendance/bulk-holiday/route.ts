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

        // Verify caller is admin or super admin
        const { data: actor } = await supabase
            .from("instructors")
            .select("id, role, is_super_admin")
            .eq("id", profileId)
            .single();

        const isAuthorized = actor?.role === "instructor";
        if (!isAuthorized) {
            return NextResponse.json({ error: "Only instructors can declare holidays" }, { status: 403 });
        }

        const { date, type, note } = await request.json();

        if (!date || !type) {
            return NextResponse.json({ error: "Date and type are required" }, { status: 400 });
        }

        // Get all active (non-archived) classes FOR THIS INSTRUCTOR
        const { data: classes } = await supabase
            .from("classes")
            .select("id")
            .eq("is_archived", false)
            .eq("instructor_id", profileId);

        if (!classes || classes.length === 0) {
            return NextResponse.json({ error: "No active classes found" }, { status: 404 });
        }

        // Upsert overrides for all classes
        const overrides = classes.map(c => ({
            class_id: c.id,
            date,
            type,
            note: note || null,
            created_by: profileId,
        }));

        const { error } = await supabase
            .from("class_day_overrides")
            .upsert(overrides, { onConflict: "class_id,date" });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Audit log
        await supabase.from("audit_logs").insert({
            actor_id: profileId,
            action: "bulk_holiday_declared",
            target_type: "system",
            target_id: date,
            details: { date, type, note, classes_affected: classes.length },
        });

        return NextResponse.json({
            success: true,
            classesAffected: classes.length,
        });
    } catch (err) {
        console.error("Bulk holiday error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
