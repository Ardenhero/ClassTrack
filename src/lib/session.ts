import { createClient } from "@/utils/supabase/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export interface SessionInfo {
    class_id: string;
    class_name: string;
    room_id: string;
    room_name: string;
    is_active_now: boolean;
    is_prep_window: boolean;
    start_time: string;
    end_time: string;
}

export interface SessionStatus {
    authorized: boolean;
    reason?: string;
    sessions: SessionInfo[];
    primary?: SessionInfo;
}

/**
 * Get the instructor's current sessions (active or prep window)
 * authoritative logic for schedule verification.
 */
export async function getInstructorSessions(instructorId: string): Promise<SessionStatus> {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
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
        const prepTime = new Date(now.getTime() + 15 * 60 * 1000);
        const prepTimeStr = prepTime.toTimeString().slice(0, 8);

        // Find classes for this instructor
        const { data: classes, error } = await supabase
            .from("classes")
            .select("id, name, room, room_id, day_of_week, start_time, end_time")
            .eq("instructor_id", instructorId)
            .not("room_id", "is", null)
            .order("start_time", { ascending: true });

        if (error) throw error;

        if (!classes || classes.length === 0) {
            return { authorized: false, reason: "no_classes", sessions: [] };
        }

        // Filter valid sessions
        const eligibleClasses = classes.filter((c) => {
            const matchesDay = !c.day_of_week || c.day_of_week === currentDay;
            if (!matchesDay || !c.start_time || !c.end_time) return false;

            const isActive =
                c.start_time <= currentTimeStr && currentTimeStr <= c.end_time;
            const isPrepWindow =
                currentTimeStr <= c.start_time && c.start_time <= prepTimeStr;

            return isActive || isPrepWindow;
        });

        if (eligibleClasses.length === 0) {
            return { authorized: false, reason: "no_active_session", sessions: [] };
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

        // Split and sort to prioritize:
        // 1. Active sessions (most recently started first)
        // 2. Prep sessions (soonest starting first)
        const activeSessions = sessions
            .filter(s => s.is_active_now)
            .sort((a, b) => b.start_time.localeCompare(a.start_time));

        const prepSessions = sessions
            .filter(s => s.is_prep_window)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

        const sortedSessions = [...activeSessions, ...prepSessions];

        // Primary session is the first one in the sorted list
        const primary = sortedSessions[0];

        return {
            authorized: true,
            sessions: sortedSessions,
            primary,
        };
    } catch (err) {
        console.error("Error verifying session:", err);
        return { authorized: false, reason: "Error verifying session", sessions: [] };
    }
}

/**
 * Check if a room currently has ANY active or prep session.
 * Used for device authorization where the device itself is the actor.
 */
export async function isRoomActive(roomId: string): Promise<boolean> {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila",
    });
    const prepTimeStr = new Date(now.getTime() + 15 * 60000).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila",
    });

    const currentDay = now.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "Asia/Manila",
    });

    // Check for any class in this room that is active OR in prep window
    const { data, error } = await supabase
        .from("classes")
        .select("id, start_time, end_time")
        .eq("room_id", roomId)
        .eq("day_of_week", currentDay)
        .or(`and(start_time.lte.${currentTimeStr},end_time.gte.${currentTimeStr}),and(start_time.gte.${currentTimeStr},start_time.lte.${prepTimeStr})`)
        .limit(1);

    if (error) {
        console.error("isRoomActive error:", error);
        return false;
    }

    return data && data.length > 0;
}

/**
 * Verify if the instructor is allowed to control the given room right now.
 */
export async function verifySessionForRoom(instructorId: string, roomId: string): Promise<boolean> {
    const status = await getInstructorSessions(instructorId);
    if (!status.authorized) return false;

    // Check if any valid session matches the target room
    return status.sessions.some(s => s.room_id === roomId);
}
