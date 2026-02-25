import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

        const isAuthorized = actor?.role === "admin" || actor?.is_super_admin;
        if (!isAuthorized) {
            return NextResponse.json({ error: "Only admins can declare system-wide suspensions" }, { status: 403 });
        }

        const { mode, date, type, note } = await request.json();

        // Get all active (non-archived) classes
        const { data: classes } = await supabase
            .from("classes")
            .select("id")
            .eq("is_archived", false);

        if (!classes || classes.length === 0) {
            return NextResponse.json({ error: "No active classes found" }, { status: 404 });
        }

        if (mode === "auto") {
            // Auto-Sync PH Holidays using Nager.Date API
            const currentYear = new Date().getFullYear();
            const phHolidaysRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/PH`);

            if (!phHolidaysRes.ok) {
                return NextResponse.json({ error: "Failed to fetch Philippines holidays from external API" }, { status: 500 });
            }

            const holidays = await phHolidaysRes.json();

            // Generate overrides for all holidays for all active classes
            const overrides: Array<{ class_id: string; date: string; type: string; note: string; created_by: string }> = [];
            for (const holiday of holidays) {
                // only process national holidays (or all returned by Nager, typically national)
                for (const c of classes) {
                    overrides.push({
                        class_id: c.id,
                        date: holiday.date,
                        type: 'holiday',
                        note: `Auto-Sync: ${holiday.name} (${holiday.localName})`,
                        created_by: profileId,
                    });
                }
            }

            if (overrides.length > 0) {
                const { error } = await supabase
                    .from("class_day_overrides")
                    .upsert(overrides, { onConflict: "class_id,date" });

                if (error) throw error;
            }

            // Audit log
            await supabase.from("audit_logs").insert({
                actor_id: profileId,
                action: "auto_sync_ph_holidays",
                target_type: "system",
                target_id: currentYear.toString(),
                details: { holidays_synced: holidays.length, classes_affected: classes.length },
            });

            return NextResponse.json({
                success: true,
                holidaysCount: holidays.length,
                classesAffected: classes.length,
            });

        } else {
            // Manual Mode
            if (!date || !type) {
                return NextResponse.json({ error: "Date and type are required" }, { status: 400 });
            }

            // MAPPING to bypass tight database constraint while preserving detail
            const overrideType = type === "holiday" ? "holiday" : "suspended";
            const typeLabel = type === "weather" ? "Weather Inclement" : type === "university" ? "University Suspension" : "Holiday";
            const finalNote = note ? `[${typeLabel}] ${note}` : `[${typeLabel}] System Declaration`;

            // Upsert overrides for all classes
            const overrides = classes.map(c => ({
                class_id: c.id,
                date,
                type: overrideType,
                note: finalNote,
                created_by: profileId,
            }));

            const { error } = await supabase
                .from("class_day_overrides")
                .upsert(overrides, { onConflict: "class_id,date" });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // Mass-insert 'No Class' attendance logs system-wide
            // Use service_role to ensure we bypass any strict instructor-level RLS policies since this is an admin macro action
            const adminSupabase = createServiceClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { data: enrollments } = await adminSupabase
                .from("enrollments")
                .select("student_id, class_id")
                .in("class_id", classes.map(c => c.id));

            if (enrollments && enrollments.length > 0) {
                // Determine a safe timezone offset for the Philippines (UTC+8) to represent 8:00 AM on that date
                const timestamp = `${date}T00:00:00Z`;

                const logsToInsert = enrollments.map((e: { student_id: string; class_id: string }) => ({
                    student_id: e.student_id,
                    class_id: e.class_id,
                    user_id: profileId,
                    status: "No Class",
                    timestamp: timestamp
                }));

                // Chunk inserts to avoid POST body limits
                for (let i = 0; i < logsToInsert.length; i += 1000) {
                    const chunk = logsToInsert.slice(i, i + 1000);
                    const { error: logErr } = await adminSupabase.from("attendance_logs").insert(chunk);
                    if (logErr) console.error("[Admin] Auto-log insert error:", logErr);
                }
            }

            // Audit log
            await supabase.from("audit_logs").insert({
                actor_id: profileId,
                action: "system_suspension_declared",
                target_type: "system",
                target_id: date,
                details: { date, type, note, classes_affected: classes.length },
            });

            return NextResponse.json({
                success: true,
                classesAffected: classes.length,
            });
        }
    } catch (err) {
        console.error("Declare suspensions error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
