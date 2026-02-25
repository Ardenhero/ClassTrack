import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/kiosk/schedule?room_id=<uuid>
 * Returns today's classes for a specific room, with the currently-active
 * class marked as "recommended" for Smart Suggest on the kiosk.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get("room_id");

        if (!roomId) {
            return NextResponse.json(
                { error: "room_id query parameter is required" },
                { status: 400 }
            );
        }

        // Get today's day name (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        // Convert to Manila time for day calculation
        const manilaOffset = 8 * 60; // UTC+8
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const manilaDate = new Date(utcMs + manilaOffset * 60000);
        const todayDay = days[manilaDate.getDay()];

        // Get current time in Manila for recommendation logic
        const nowManila = manilaDate.toLocaleTimeString('en-US', { hour12: false });
        const currentMinutes = (() => {
            const parts = nowManila.split(':').map(Number);
            return parts[0] * 60 + parts[1];
        })();

        // Fetch classes assigned to this room for today
        const { data: classes, error } = await supabase
            .from('classes')
            .select('id, name, start_time, end_time, year_level, instructor_id, day_of_week, instructors!classes_instructor_id_fkey(name)')
            .eq('room_id', roomId)
            .order('start_time');

        if (error) throw error;

        // Filter by day of week and mark recommended
        const getMinutes = (timeStr: string | null) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':').map(Number);
            return parts[0] * 60 + parts[1];
        };

        const todayClasses = (classes || [])
            .filter((c: { day_of_week: string | null }) => {
                if (!c.day_of_week) return false;
                // day_of_week might be comma-separated or array-like
                const daysStr = c.day_of_week.replace(/[\[\]'"\s]/g, '');
                return daysStr.split(',').some((d: string) => d.trim() === todayDay);
            })
            .map((c: { id: string; name: string; start_time: string | null; end_time: string | null; year_level: string | null; instructor_id: string; instructors: { name: string } | { name: string }[] | null }) => {
                const startMin = getMinutes(c.start_time);
                const endMin = getMinutes(c.end_time);
                // Recommended: current time is within class window (with 15min buffer before start)
                const isRecommended = currentMinutes >= (startMin - 15) && currentMinutes <= endMin;

                return {
                    id: c.id,
                    name: c.name,
                    start_time: c.start_time,
                    end_time: c.end_time,
                    year_level: c.year_level,
                    instructor_id: c.instructor_id,
                    instructor_name: Array.isArray(c.instructors)
                        ? c.instructors[0]?.name
                        : c.instructors?.name || 'Unknown',
                    recommended: isRecommended,
                };
            });

        return NextResponse.json({
            room_id: roomId,
            day: todayDay,
            current_time: nowManila,
            classes: todayClasses,
        });

    } catch (err) {
        console.error("[Kiosk Schedule] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
