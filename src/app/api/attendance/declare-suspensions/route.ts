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

        const isAuthorized = actor?.role === "admin" || actor?.is_super_admin;
        if (!isAuthorized) {
            return NextResponse.json({ error: "Only admins can declare system-wide suspensions" }, { status: 403 });
        }

        const { mode, date, type, duration, note } = await request.json();

        // Get all active (non-archived) classes
        const { data: classes } = await supabase
            .from("classes")
            .select("id, start_time")
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
            const durationLabel = duration && duration !== "Whole Day" ? ` (${duration})` : "";
            const finalNote = note ? `[${typeLabel}]${durationLabel} ${note}` : `[${typeLabel}]${durationLabel} System Declaration`;

            // Filter classes based on duration if applicable
            let affectedClasses = classes;
            if (duration === "Half Day (Morning)") {
                affectedClasses = classes.filter(c => c.start_time && c.start_time < "12:00:00");
            } else if (duration === "Half Day (Afternoon)") {
                affectedClasses = classes.filter(c => c.start_time && c.start_time >= "12:00:00");
            }

            if (affectedClasses.length === 0) {
                return NextResponse.json({
                    success: true,
                    classesAffected: 0,
                    message: "No classes matched the selected duration.",
                });
            }

            // Upsert overrides for affected classes
            const overrides = affectedClasses.map(c => ({
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

            // Audit log
            await supabase.from("audit_logs").insert({
                actor_id: profileId,
                action: "system_suspension_declared",
                target_type: "system",
                target_id: date,
                details: { date, type, duration, note, classes_affected: affectedClasses.length },
            });

            return NextResponse.json({
                success: true,
                classesAffected: affectedClasses.length,
            });
        }
    } catch (err) {
        console.error("Declare suspensions error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
