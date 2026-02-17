import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice } from "@/lib/tuya";
import { resolveWebIdentity, authenticateDevice } from "@/lib/resolve-identity";
import { verifySessionForRoom } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/iot/group-control
 * Controls a group of devices (lights, fans, ACs) in a specific room.
 *
 * Authorization:
 * 1. Authenticate Source (Web Session or Device Token)
 * 2. Resolve Actor (Instructor ID)
 * 3. Authorize Action (Schedule Check for Room + Department Check)
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        let { room_id } = body;
        const { group_type, action, source, token } = body;
        let { instructor_id } = body;

        // Headers check for token
        const headerToken = request.headers.get("x-device-token");
        const deviceToken = headerToken || token;

        if (!group_type || !action) {
            return NextResponse.json(
                { error: "Missing required fields: group_type, action" },
                { status: 400 }
            );
        }

        // ========================================
        // 1. AUTHENTICATE SOURCE
        // ========================================
        let isDeviceAuth = false;
        let isWebAuth = false;
        let authDevice: { id: string; room_id: string; department_id: string } | undefined;
        let authWebIdentity: { instructor_id: string; department_id: string } | null = null;
        let logDeptId: string | null = null;

        // Check Device Token
        const authResult = await authenticateDevice(deviceToken, null);
        if (authResult) {
            isDeviceAuth = true;
            authDevice = authResult.device;

            // Enforce Specific Token Binding
            if (authResult.type === 'specific' && authDevice) {
                // Infer room_id if missing
                if (!room_id) {
                    room_id = authDevice.room_id;
                } else if (authDevice.room_id !== room_id) {
                    return NextResponse.json(
                        { error: "Unauthorized: Token does not match target room" },
                        { status: 403 }
                    );
                }
            } else {
                // Global Token requires explicit room_id
                if (!room_id) {
                    return NextResponse.json(
                        { error: "Missing room_id (required for global token)" },
                        { status: 400 }
                    );
                }
            }
        } else {
            // Check Web Session
            // Web Auth requires explicit room_id
            if (!room_id) {
                return NextResponse.json(
                    { error: "Missing room_id" },
                    { status: 400 }
                );
            }
            authWebIdentity = await resolveWebIdentity();
            if (authWebIdentity) {
                isWebAuth = true;
            }
        }

        if (!isDeviceAuth && !isWebAuth) {
            return NextResponse.json(
                { error: "Unauthorized: Missing valid session or device token" },
                { status: 401 }
            );
        }

        // ========================================
        // 2. AUTHORIZE ACTION
        // ========================================

        // Verify Room Exists
        const { data: room } = await supabase
            .from("rooms")
            .select("id, department_id, name")
            .eq("id", room_id)
            .single();

        if (!room) {
            return NextResponse.json({ error: "Room not found" }, { status: 404 });
        }

        if (isDeviceAuth) {
            // A. DEVICE AUTHORIZATION
            // 1. Department Check (if specific device known)
            if (authDevice && authDevice.department_id !== room.department_id) {
                return NextResponse.json({ error: "Cross-department access denied" }, { status: 403 });
            }

            // 2. Schedule Check (Is the room active?)
            // We check if the room has ANY active session.
            const { isRoomActive } = await import("@/lib/session");
            const isActiveCallback = await isRoomActive(room_id);
            if (!isActiveCallback) {
                return NextResponse.json(
                    { error: "Room is not active (no scheduled class)" },
                    { status: 403 }
                );
            }

            // Setup logging context
            logDeptId = authDevice?.department_id || room.department_id; // Best effort
            instructor_id = instructor_id || null; // Optional from device

        } else if (isWebAuth && authWebIdentity) {
            // B. WEB AUTHORIZATION
            // 1. Department Check
            if (authWebIdentity.department_id !== room.department_id) {
                return NextResponse.json({ error: "Cross-department access denied" }, { status: 403 });
            }

            // 2. Schedule Check
            const isAuthorized = await verifySessionForRoom(authWebIdentity.instructor_id, room_id);
            if (!isAuthorized) {
                return NextResponse.json(
                    { error: "Not authorized to control this room at this time" },
                    { status: 403 }
                );
            }

            // Setup logging context
            logDeptId = authWebIdentity.department_id;
            instructor_id = authWebIdentity.instructor_id;
        } else {
            return NextResponse.json({ error: "Authorization error" }, { status: 401 });
        }

        // ========================================
        // 3. EXECUTE
        // ========================================

        // Map group type to roles
        let roles: string[] = [];
        if (group_type === "LIGHTS") roles = ["LIGHT"];
        else if (group_type === "FANS") roles = ["FAN"];
        else if (group_type === "ACS") roles = ["AC"];
        else {
            return NextResponse.json(
                { error: "Invalid group_type" },
                { status: 400 }
            );
        }

        if (action !== "ON" && action !== "OFF") {
            return NextResponse.json(
                { error: "Invalid action. Must be 'ON' or 'OFF'." },
                { status: 400 }
            );
        }
        const targetState = action === "ON";

        // Fetch devices (endpoints)
        const { data: endpoints } = await supabase
            .from("device_endpoints")
            .select("device_id, dp_code, role")
            .eq("room_id", room_id)
            .in("role", roles);

        if (!endpoints || endpoints.length === 0) {
            return NextResponse.json(
                { message: "No devices found for this group" },
                { status: 200 }
            );
        }

        // Control each device
        const results = await Promise.allSettled(
            endpoints.map(async (ep) => {
                const realId = ep.device_id.replace(/_ch\d+$/, "");
                const code = ep.dp_code;

                if (!code) {
                    console.warn(`[GroupControl] Endpoint missing dp_code: ${ep.device_id}`);
                    return { device_id: ep.device_id, success: false, error: "Missing dp_code" };
                }

                const res = await controlDevice(realId, code, targetState);
                return { device_id: ep.device_id, success: res.success };
            })
        );

        // Update DB for all successful controls
        const successfulIds = results
            .filter(
                (r): r is PromiseFulfilledResult<{ device_id: string; success: boolean }> =>
                    r.status === "fulfilled" && r.value.success
            )
            .map((r) => r.value.device_id);

        if (successfulIds.length > 0) {
            await supabase
                .from("iot_devices")
                .update({
                    current_state: targetState,
                    updated_at: new Date().toISOString(),
                })
                .in("id", successfulIds);

            // Log actions
            const logs = successfulIds.map(id => ({
                device_id: id,
                code: action,
                value: targetState,
                source: source || (isDeviceAuth ? "esp32" : "web"),
                triggered_by: instructor_id,
                department_id: logDeptId,
                room_id: room_id,
            }));

            await supabase.from("iot_device_logs").insert(logs);
        }

        return NextResponse.json({
            success: true,
            results: results.map((r) =>
                r.status === "fulfilled" ? r.value : { error: "failed" }
            ),
        });
    } catch (err) {
        console.error("[IoT Group Control] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
