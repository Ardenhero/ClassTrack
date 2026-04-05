import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/kiosk/class-status?class_id=XXX
 * 
 * Returns the schedule-based lock state for the kiosk.
 * 
 * Time windows (example: class 8:00–9:30):
 *   Before 7:45        → LOCKED
 *   7:45 – 8:30        → CHECK_IN  (15min before + 30min after start)
 *   8:30 – 9:15        → LOCKED    (mid-class)
 *   9:15 – 9:45        → CHECK_OUT (15min before + 15min after end)
 *   After 9:45          → CLOSED
 * 
 * If the class is not scheduled today → LOCKED with is_scheduled_today=false
 * If the class is suspended → SUSPENDED
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const classId = searchParams.get("class_id");

        if (!classId) {
            return NextResponse.json({ error: "class_id required" }, { status: 400 });
        }

        // Get class data
        const { data: cls, error } = await supabase
            .from('classes')
            .select('id, name, start_time, end_time, schedule_days, day_of_week')
            .eq('id', classId)
            .single();

        if (error || !cls) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        // Manila time
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const manilaOffset = 8 * 60;
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const manilaDate = new Date(utcMs + manilaOffset * 60000);
        const todayDay = days[manilaDate.getDay()];

        // Current time in minutes
        const currentMinutes = manilaDate.getHours() * 60 + manilaDate.getMinutes();

        // Check if scheduled today
        const scheduleDays = cls.schedule_days || cls.day_of_week || '';
        const daysStr = scheduleDays.replace(/[\[\]'"\s]/g, '');
        const isScheduledToday = daysStr.split(',').some((d: string) => d.trim() === todayDay);

        if (!isScheduledToday) {
            return NextResponse.json({
                status: "LOCKED",
                is_scheduled_today: false,
                message: `Not scheduled today (${todayDay})`,
                schedule_days: scheduleDays,
                today: todayDay,
            });
        }

        // Check suspension
        const dateStr = manilaDate.toISOString().split("T")[0];
        const { data: overrides } = await supabase
            .from("class_day_overrides")
            .select("id, type, note")
            .eq("class_id", classId)
            .eq("date", dateStr)
            .limit(1);

        if (overrides && overrides.length > 0) {
            return NextResponse.json({
                status: "SUSPENDED",
                is_scheduled_today: true,
                message: overrides[0].note || overrides[0].type || "Class suspended",
            });
        }

        // Parse times
        const getMinutes = (timeStr: string | null) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':').map(Number);
            return parts[0] * 60 + (parts[1] || 0);
        };

        const startMin = getMinutes(cls.start_time);
        const endMin = getMinutes(cls.end_time);

        // Define windows
        const CHECK_IN_BEFORE = 15;  // Minutes before class start to open check-in
        const CHECK_IN_AFTER = 30;   // Minutes after class start (late window)
        const CHECK_OUT_BEFORE = 15; // Minutes before class end to open check-out
        const CHECK_OUT_AFTER = 15;  // Minutes after class end

        const checkInStart = startMin - CHECK_IN_BEFORE;
        const checkInEnd = startMin + CHECK_IN_AFTER;
        const checkOutStart = endMin - CHECK_OUT_BEFORE;
        const checkOutEnd = endMin + CHECK_OUT_AFTER;

        // Opening soon: 5 minutes before check-in opens
        const openingSoonStart = checkInStart - 5;

        // Determine status
        let status: string;
        let message: string;
        let countdownSeconds = 0;

        if (currentMinutes < openingSoonStart) {
            status = "LOCKED";
            countdownSeconds = (checkInStart - currentMinutes) * 60;
            message = `Check-in opens at ${formatTime(checkInStart)}`;
        } else if (currentMinutes >= openingSoonStart && currentMinutes < checkInStart) {
            status = "OPENING_SOON";
            countdownSeconds = (checkInStart - currentMinutes) * 60;
            message = `Opening in ${checkInStart - currentMinutes} min`;
        } else if (currentMinutes >= checkInStart && currentMinutes <= checkInEnd) {
            status = "CHECK_IN";
            const isLate = currentMinutes > startMin;
            countdownSeconds = (checkInEnd - currentMinutes) * 60;
            message = isLate
                ? `Late check-in (closes at ${formatTime(checkInEnd)})`
                : `Check-in open (class starts at ${formatTime(startMin)})`;
        } else if (currentMinutes > checkInEnd && currentMinutes < checkOutStart) {
            status = "LOCKED";
            countdownSeconds = (checkOutStart - currentMinutes) * 60;
            message = `Class in progress. Check-out at ${formatTime(checkOutStart)}`;
        } else if (currentMinutes >= checkOutStart && currentMinutes <= checkOutEnd) {
            status = "CHECK_OUT";
            countdownSeconds = (checkOutEnd - currentMinutes) * 60;
            message = `Check-out open (closes at ${formatTime(checkOutEnd)})`;
        } else {
            status = "CLOSED";
            message = "Class session ended";
        }

        return NextResponse.json({
            status,
            is_scheduled_today: true,
            message,
            countdown_seconds: countdownSeconds,
            check_in_window: {
                start: formatTime(checkInStart),
                end: formatTime(checkInEnd),
            },
            check_out_window: {
                start: formatTime(checkOutStart),
                end: formatTime(checkOutEnd),
            },
            class_start: cls.start_time,
            class_end: cls.end_time,
            today: todayDay,
            current_time: `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`,
        });

    } catch (err) {
        console.error("[Kiosk ClassStatus] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function formatTime(minutes: number): string {
    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const h12 = h24 % 12 || 12;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
