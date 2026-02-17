import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/iot/active-session?instructor_id=...
 *
 * Returns the instructor's current active session (room + schedule),
 * with authorization status (is_now or prep_window).
 *
 * Used by both ESP32 and web to determine which room to control.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const instructorId = searchParams.get("instructor_id");

        if (!instructorId) {
            return NextResponse.json(
                { error: "Missing instructor_id" },
                { status: 400 }
            );
        }

        // Get Manila time components
        const now = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
        );
        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];
        const currentDay = days[now.getDay()];
        const currentTimeStr = now.toTimeString().slice(0, 8); // HH:MM:SS

        // 15-minute prep window: time + 15 min
        const prepTime = new Date(now.getTime() + 15 * 60 * 1000);
        const prepTimeStr = prepTime.toTimeString().slice(0, 8);

        // Find classes for this instructor that are active now or starting within 15 min
        const { data: classes, error } = await supabase
            .from("classes")
            .select("id, name, room, room_id, day_of_week, start_time, end_time")
            .eq("instructor_id", instructorId)
            .not("room_id", "is", null);

        if (error) throw error;

        if (!classes || classes.length === 0) {
            return NextResponse.json({
                authorized: false,
                reason: "no_classes",
                sessions: [],
            });
        }

        // Filter to classes that match today or have no day_of_week set
        const eligibleClasses = classes.filter((c) => {
            const matchesDay = !c.day_of_week || c.day_of_week === currentDay;
            if (!matchesDay || !c.start_time || !c.end_time) return false;

            // Check: currently in session (start <= now <= end)
            const isActive =
                c.start_time <= currentTimeStr && currentTimeStr <= c.end_time;

            // Check: starts within next 15 min (now <= start <= now+15)
            const isPrepWindow =
                currentTimeStr <= c.start_time && c.start_time <= prepTimeStr;

            return isActive || isPrepWindow;
        });

        if (eligibleClasses.length === 0) {
            return NextResponse.json({
                authorized: false,
                reason: "no_active_session",
                sessions: [],
            });
        }

        const sessions = eligibleClasses.map((c) => {
            const isActive =
                c.start_time <= currentTimeStr && currentTimeStr <= c.end_time;
            return {
                class_id: c.id,
                class_name: c.name,
                room_id: c.room_id,
                room_name: c.room,
                is_active_now: isActive,
                is_prep_window: !isActive,
                start_time: c.start_time,
                end_time: c.end_time,
            };
        });

        return NextResponse.json({
            authorized: true,
            sessions,
            // Primary session (prefer active over prep)
            primary:
                sessions.find((s) => s.is_active_now) || sessions[0],
        });
    } catch (err) {
        console.error("[IoT Active Session] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
