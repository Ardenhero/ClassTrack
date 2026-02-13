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

        // Verify caller is admin
        const { data: actor } = await supabase
            .from("instructors")
            .select("id, role")
            .eq("id", profileId)
            .single();

        if (!actor || actor.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
        }

        const { evidence_id, action } = await request.json();

        if (!evidence_id || !["approve", "reject"].includes(action)) {
            return NextResponse.json({ error: "Missing evidence_id or invalid action" }, { status: 400 });
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        // Update evidence document status
        const { error: updateError } = await supabase
            .from("evidence_documents")
            .update({
                status: newStatus,
                reviewed_by: actor.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", evidence_id);

        if (updateError) {
            return NextResponse.json({ error: "Failed to update evidence" }, { status: 500 });
        }

        // If approved, update attendance_logs for all linked dates
        if (action === "approve") {
            // Get the evidence document to find student_id
            const { data: evidence } = await supabase
                .from("evidence_documents")
                .select("student_id, class_id")
                .eq("id", evidence_id)
                .single();

            if (evidence) {
                // Get all linked dates
                const { data: dateLinks } = await supabase
                    .from("evidence_date_links")
                    .select("absence_date")
                    .eq("evidence_id", evidence_id);

                if (dateLinks && dateLinks.length > 0) {
                    // For each linked date, find and update matching attendance logs
                    for (const link of dateLinks) {
                        const dayStart = `${link.absence_date}T00:00:00+08:00`;
                        const dayEnd = `${link.absence_date}T23:59:59+08:00`;

                        // Get class_id from evidence to filter specific class
                        const targetClassId = evidence.class_id;

                        let query = supabase
                            .from("attendance_logs")
                            .update({ status: "Excused" })
                            .eq("student_id", evidence.student_id)
                            .gte("timestamp", dayStart)
                            .lte("timestamp", dayEnd)
                            .in("status", ["Absent", "absent"]); // Only update if currently absent

                        // If evidence is linked to a specific class, only excuse that class
                        if (targetClassId) {
                            query = query.eq("class_id", targetClassId);
                        }

                        await query;
                    }
                }
            }
        }

        // Audit log
        await supabase.from("audit_logs").insert({
            actor_id: actor.id,
            action: `evidence_${action}`,
            target_type: "evidence",
            target_id: evidence_id,
            details: { status: newStatus },
        });

        return NextResponse.json({ success: true, status: newStatus });
    } catch (err) {
        console.error("Evidence review error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
