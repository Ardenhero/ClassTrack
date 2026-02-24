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

            // SMS Notifications via Semaphore
            const semaphoreKey = process.env.SEMAPHORE_API_KEY;
            let smsSentCount = 0;

            if (semaphoreKey) {
                // Fetch all active students' phone numbers
                const { data: students } = await supabase
                    .from("students")
                    .select("phone_number")
                    .eq("is_archived", false)
                    .not("phone_number", "is", null)
                    .neq("phone_number", "");

                if (students && students.length > 0) {
                    // Filter valid PH numbers (starts with 09 or +639)
                    const validNumbers = students
                        .map(s => s.phone_number?.trim())
                        .filter(num => num && (num.startsWith('09') || num.startsWith('+639')))
                        .map(num => num?.startsWith('+63') ? `09${num?.substring(3)}` : num);

                    const uniqueNumbers = Array.from(new Set(validNumbers)) as string[];

                    if (uniqueNumbers.length > 0) {
                        const typeLabel = type === "weather" ? "Weather Inclement" : type === "university" ? "University Suspension" : "Holiday";
                        const message = `ClassTrack Alert: Classes are suspended on ${date} due to ${typeLabel}. Note: ${note || "No classes. Keep safe!"}`;

                        // Semaphore allows up to 1000 numbers per request
                        const numberChunks = [];
                        for (let i = 0; i < uniqueNumbers.length; i += 1000) {
                            numberChunks.push(uniqueNumbers.slice(i, i + 1000).join(','));
                        }

                        for (const chunk of numberChunks) {
                            try {
                                const params = new URLSearchParams({
                                    apikey: semaphoreKey,
                                    number: chunk,
                                    message: message
                                });

                                if (process.env.SEMAPHORE_SENDER_NAME) {
                                    params.append("sendername", process.env.SEMAPHORE_SENDER_NAME);
                                }

                                const smsRes = await fetch("https://api.semaphore.co/api/v4/messages", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                    body: params
                                });

                                if (smsRes.ok) {
                                    smsSentCount += chunk.split(',').length;
                                } else {
                                    console.error("Semaphore API rejected:", await smsRes.text());
                                }
                            } catch (smsErr) {
                                console.error("Semaphore SMS error:", smsErr);
                            }
                        }
                    }
                }
            }

            // Audit log
            await supabase.from("audit_logs").insert({
                actor_id: profileId,
                action: "system_suspension_declared",
                target_type: "system",
                target_id: date,
                details: { date, type, note, classes_affected: classes.length, sms_sent: smsSentCount },
            });

            return NextResponse.json({
                success: true,
                classesAffected: classes.length,
                smsSent: smsSentCount
            });
        }
    } catch (err) {
        console.error("Declare suspensions error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
