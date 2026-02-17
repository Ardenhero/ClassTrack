import { NextResponse } from "next/server";
import { resolveWebIdentity } from "@/lib/resolve-identity";
import { getInstructorSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/iot/active-session?instructor_id=...
 *
 * Returns the instructor's current active session (room + schedule),
 * with authorization status (is_now or prep_window).
 *
 * Identity resolution:
 * - If instructor_id query param provided (ESP32): use that directly
 * - If not provided (web): resolve from auth session server-side
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let instructorId = searchParams.get("instructor_id");

        // If no instructor_id in query, resolve from auth session (web path)
        if (!instructorId) {
            const identity = await resolveWebIdentity();
            if (identity) {
                instructorId = identity.instructor_id;
            }
        }

        if (!instructorId) {
            return NextResponse.json(
                { authorized: false, reason: "no_identity", sessions: [] },
                { status: 200 }
            );
        }

        // Use shared session logic source of truth
        const sessionStatus = await getInstructorSessions(instructorId);

        return NextResponse.json(sessionStatus);
    } catch (err) {
        console.error("[IoT Active Session] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
