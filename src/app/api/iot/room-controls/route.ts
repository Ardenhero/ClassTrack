import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveWebIdentity } from "@/lib/resolve-identity";

export const dynamic = "force-dynamic";

interface DeviceEndpoint {
    id: string;
    device_id: string;
    endpoint_kind: string;
    endpoint_index: number;
    role: string;
    zone_name: string | null;
    label: string;
    dp_code: string;
}

/**
 * GET /api/iot/room-controls?room_id=...
 *
 * Returns device endpoints for the authorized room, grouped by role.
 * Identity resolved server-side from auth session (web) or instructor_id query param (ESP32).
 * Enforces schedule-based + department authorization.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        let instructorId = searchParams.get("instructor_id");
        const roomId = searchParams.get("room_id");

        // Resolve identity server-side if not provided (web path)
        let resolvedDepartmentId: string | null = null;
        if (!instructorId) {
            const identity = await resolveWebIdentity();
            if (!identity) {
                return NextResponse.json(
                    { error: "Authentication required" },
                    { status: 401 }
                );
            }
            instructorId = identity.instructor_id;
            resolvedDepartmentId = identity.department_id;
        }

        // Step 1: Verify instructor is authorized for this room (pass through to active-session)
        const sessionRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/iot/active-session?instructor_id=${instructorId}`,
            { cache: "no-store" }
        );
        const sessionData = await sessionRes.json();

        if (!sessionData.authorized) {
            return NextResponse.json(
                {
                    error: "Not authorized",
                    reason: sessionData.reason,
                    groups: { LIGHT_GROUP: [], FAN_GROUP: [], AC_GROUP: [] },
                },
                { status: 403 }
            );
        }

        // If room_id provided, verify it's in the authorized sessions
        const targetRoomId =
            roomId ||
            sessionData.primary?.room_id;

        if (!targetRoomId) {
            return NextResponse.json(
                { error: "No room found for session" },
                { status: 404 }
            );
        }

        const authorizedRoomIds = sessionData.sessions.map(
            (s: { room_id: string }) => s.room_id
        );
        if (!authorizedRoomIds.includes(targetRoomId)) {
            return NextResponse.json(
                { error: "Not authorized for this room" },
                { status: 403 }
            );
        }

        // Step 2: Verify instructor belongs to the same department as the room
        const { data: room } = await supabase
            .from("rooms")
            .select("id, department_id, name")
            .eq("id", targetRoomId)
            .single();

        if (!room) {
            return NextResponse.json({ error: "Room not found" }, { status: 404 });
        }

        // Use server-resolved department_id if available, otherwise look it up
        if (!resolvedDepartmentId) {
            const { data: instructor } = await supabase
                .from("instructors")
                .select("department_id")
                .eq("id", instructorId)
                .single();
            resolvedDepartmentId = instructor?.department_id || null;
        }

        if (resolvedDepartmentId && resolvedDepartmentId !== room.department_id) {
            return NextResponse.json(
                { error: "Cross-department access denied" },
                { status: 403 }
            );
        }

        // Step 3: Fetch endpoints for this room
        const { data: endpoints, error } = await supabase
            .from("device_endpoints")
            .select("id, device_id, endpoint_kind, endpoint_index, role, zone_name, label, dp_code")
            .eq("room_id", targetRoomId)
            .order("role")
            .order("endpoint_index");

        if (error) throw error;

        // Step 4: Get current device states
        const deviceIds = Array.from(
            new Set((endpoints || []).map((ep: DeviceEndpoint) => ep.device_id))
        );
        const { data: devices } = await supabase
            .from("iot_devices")
            .select("id, current_state, online")
            .in("id", deviceIds.length > 0 ? deviceIds : ["__none__"]);

        const deviceStateMap: Record<
            string,
            { current_state: boolean; online: boolean }
        > = {};
        (devices || []).forEach(
            (d: { id: string; current_state: boolean; online: boolean }) => {
                deviceStateMap[d.id] = {
                    current_state: d.current_state,
                    online: d.online,
                };
            }
        );

        // Step 5: Fetch session_state for auto-on info
        const todayStr = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
        )
            .toISOString()
            .slice(0, 10);
        const activeClassId = sessionData.primary?.class_id;

        const { data: sessionState } = await supabase
            .from("session_state")
            .select("auto_on_done, manual_override")
            .eq("room_id", targetRoomId)
            .eq("session_date", todayStr)
            .eq("class_id", activeClassId)
            .maybeSingle();

        // Step 6: Group endpoints by role
        const groups: Record<string, (DeviceEndpoint & { current_state: boolean; online: boolean })[]> = {
            LIGHT_GROUP: [],
            FAN_GROUP: [],
            AC_GROUP: [],
        };

        (endpoints || []).forEach((ep: DeviceEndpoint) => {
            const state = deviceStateMap[ep.device_id] || {
                current_state: false,
                online: false,
            };
            const enriched = { ...ep, ...state };

            if (ep.role === "LIGHT") groups.LIGHT_GROUP.push(enriched);
            else if (ep.role === "FAN") groups.FAN_GROUP.push(enriched);
            else if (ep.role === "AC") groups.AC_GROUP.push(enriched);
        });

        return NextResponse.json({
            room_id: targetRoomId,
            room_name: room.name,
            session: sessionData.primary,
            session_state: sessionState || {
                auto_on_done: false,
                manual_override: false,
            },
            groups,
            all_endpoints: (endpoints || []).map((ep: DeviceEndpoint) => ({
                ...ep,
                ...(deviceStateMap[ep.device_id] || {
                    current_state: false,
                    online: false,
                }),
            })),
        });
    } catch (err) {
        console.error("[IoT Room Controls] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
