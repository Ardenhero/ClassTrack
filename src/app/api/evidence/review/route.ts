import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Verify caller is an instructor (admin or regular)
        const { data: actor } = await supabase
            .from("instructors")
            .select("id, role")
            .eq("id", profileId)
            .single();

        if (!actor) {
            return NextResponse.json({ error: "Forbidden: Not an instructor" }, { status: 403 });
        }

        const { evidence_id, action } = await request.json();

        if (!evidence_id || !["approve", "reject"].includes(action)) {
            return NextResponse.json({ error: "Missing evidence_id or invalid action" }, { status: 400 });
        }

        // Check ownership/permissions
        // Admins can review ANY evidence. Instructors can only review evidence for THEIR classes.
        if (actor.role !== "admin") {
            // Fetch evidence to check class ownership
            const { data: evidenceToCheck } = await supabase
                .from("evidence_documents")
                .select("class_id, classes(instructor_id)")
                .eq("id", evidence_id)
                .single();

            // Expected type for join
            interface EvidenceWithClass {
                class_id: string;
                classes: { instructor_id: string } | null;
            }

            const evidence = evidenceToCheck as unknown as EvidenceWithClass;

            if (!evidence || !evidence.classes || evidence.classes.instructor_id !== actor.id) {
                return NextResponse.json({ error: "Forbidden: You can only review evidence for your own classes" }, { status: 403 });
            }
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
                    // Use Service Role to bypass RLS for updating student attendance
                    const adminClient = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!
                    );

                    // For each linked date, find and update matching attendance logs
                    // For each linked date, find and update matching attendance logs
                    for (const link of dateLinks) {
                        try {
                            const dateParts = link.absence_date.split('-');
                            if (dateParts.length !== 3) {
                                console.error(`Invalid date format: ${link.absence_date}`);
                                continue;
                            }
                            const year = parseInt(dateParts[0]);
                            const month = parseInt(dateParts[1]) - 1;
                            const day = parseInt(dateParts[2]);

                            // UTC range for PH time (+8)
                            // Start of day: 00:00:00 PH = Previous day 16:00:00 UTC
                            const startUTC = new Date(Date.UTC(year, month, day, 0, 0, 0));
                            startUTC.setUTCHours(startUTC.getUTCHours() - 8);

                            // End of day: 23:59:59 PH = Current day 15:59:59 UTC
                            const endUTC = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
                            endUTC.setUTCHours(endUTC.getUTCHours() - 8);

                            const startISO = startUTC.toISOString();
                            const endISO = endUTC.toISOString();

                            console.log(`Processing attendance: Student ${evidence.student_id}, Class ${evidence.class_id || 'All'}, Date ${link.absence_date}, Range ${startISO} - ${endISO}`);

                            // 1. Try to find existing record
                            let query = adminClient
                                .from("attendance_logs")
                                .select("id, status")
                                .eq("student_id", evidence.student_id)
                                .gte("timestamp", startISO)
                                .lte("timestamp", endISO);

                            if (evidence.class_id) {
                                query = query.eq("class_id", evidence.class_id);
                            }

                            const { data: existingLogs, error: fetchError } = await query;

                            if (fetchError) {
                                console.error(`Failed to fetch attendance for ${link.absence_date}:`, fetchError);
                                continue;
                            }

                            if (existingLogs && existingLogs.length > 0) {
                                // UPDATE existing records
                                console.log(`Found ${existingLogs.length} existing records. Updating to Excused.`);

                                let updateQuery = adminClient
                                    .from("attendance_logs")
                                    .update({ status: "Excused" })
                                    .eq("student_id", evidence.student_id)
                                    .gte("timestamp", startISO)
                                    .lte("timestamp", endISO)
                                    // Update even if present, late, absent etc.
                                    .in("status", ["Absent", "absent", "Late", "late", "Cut Class", "cut class", "Present", "present"]);

                                if (evidence.class_id) {
                                    updateQuery = updateQuery.eq("class_id", evidence.class_id);
                                }

                                const { error: updateError } = await updateQuery;
                                if (updateError) {
                                    console.error(`Update failed for ${link.absence_date}:`, updateError);
                                }
                            } else {
                                // INSERT new record
                                console.log(`No existing records found for ${link.absence_date}. Inserting new 'Excused' record.`);

                                // Need user_id for the insert (it's nullable but good to have)
                                // Fetch student user_id
                                const { data: studentData } = await adminClient
                                    .from("students")
                                    .select("user_id")
                                    .eq("id", evidence.student_id)
                                    .single();

                                // Construct timestamp: Noon PH time = 04:00:00 UTC
                                // This ensures it falls safely in the middle of the day
                                const insertTimestamp = new Date(Date.UTC(year, month, day, 4, 0, 0)).toISOString();

                                const { error: insertError } = await adminClient
                                    .from("attendance_logs")
                                    .insert({
                                        student_id: evidence.student_id,
                                        class_id: evidence.class_id, // If null, this might fail if class_id is NOT NULL. But public upload sets it.
                                        user_id: studentData?.user_id || null,
                                        timestamp: insertTimestamp,
                                        status: "Excused"
                                    });

                                if (insertError) {
                                    console.error(`Insert failed for ${link.absence_date}:`, insertError);
                                } else {
                                    console.log(`Successfully inserted 'Excused' record for ${link.absence_date}`);
                                }
                            }

                        } catch (e) {
                            console.error(`Error processing ${link.absence_date}:`, e);
                        }
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
