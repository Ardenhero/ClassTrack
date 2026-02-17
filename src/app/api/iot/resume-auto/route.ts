import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveWebIdentity } from "@/lib/resolve-identity";

export const dynamic = "force-dynamic";

/**
 * POST /api/iot/resume-auto
 *
 * Resets manual_override to false for the current session,
 * allowing auto-on to trigger again on next attendance scan.
 * Identity resolved server-side.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const { room_id, class_id } = body;

        // Resolve identity server-side
        const identity = await resolveWebIdentity();
        if (!identity) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        if (!room_id) {
            return NextResponse.json(
                { error: "Missing room_id" },
                { status: 400 }
            );
        }

        const todayStr = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
        )
            .toISOString()
            .slice(0, 10);

        // Verify authorization via active-session
        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const sessionRes = await fetch(
            `${baseUrl}/api/iot/active-session?instructor_id=${identity.instructor_id}`,
            { cache: "no-store" }
        );
        const sessionData = await sessionRes.json();

        if (!sessionData.authorized) {
            return NextResponse.json(
                { error: "Not authorized" },
                { status: 403 }
            );
        }

        // Get room department
        const { data: room } = await supabase
            .from("rooms")
            .select("department_id")
            .eq("id", room_id)
            .single();

        if (!room) {
            return NextResponse.json(
                { error: "Room not found" },
                { status: 404 }
            );
        }

        const { error } = await supabase.from("session_state").upsert(
            {
                department_id: room.department_id,
                room_id,
                class_id: class_id || sessionData.primary?.class_id || null,
                session_date: todayStr,
                manual_override: false,
                auto_on_done: false,
                last_changed_by: "web",
                updated_at: new Date().toISOString(),
            },
            { onConflict: "room_id,session_date,class_id" }
        );

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: "Auto mode resumed. Next attendance scan will trigger auto-on.",
        });
    } catch (err) {
        console.error("[IoT Resume Auto] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
