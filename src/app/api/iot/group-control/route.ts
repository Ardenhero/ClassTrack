import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice as tuyaControlDevice } from "@/lib/tuya";

export const dynamic = "force-dynamic";

interface GroupControlBody {
    instructor_id: string;
    room_id: string;
    group_type: "LIGHTS" | "FANS" | "ACS";
    action: "ON" | "OFF";
    source?: string;
}

const GROUP_ROLE_MAP: Record<string, string> = {
    LIGHTS: "LIGHT",
    FANS: "FAN",
    ACS: "AC",
};

/**
 * POST /api/iot/group-control
 *
 * Controls all endpoints of a group type (LIGHTS/FANS/ACS) in a room.
 * Enforces schedule + department authorization.
 * Updates session_state on manual actions.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body: GroupControlBody = await request.json();
        const { instructor_id, room_id, group_type, action, source } = body;

        // Validation
        if (!instructor_id || !room_id || !group_type || !action) {
            return NextResponse.json(
                {
                    error: "Missing required fields",
                    required: ["instructor_id", "room_id", "group_type", "action"],
                },
                { status: 400 }
            );
        }

        if (!["LIGHTS", "FANS", "ACS"].includes(group_type)) {
            return NextResponse.json(
                { error: "Invalid group_type. Must be LIGHTS, FANS, or ACS" },
                { status: 400 }
            );
        }

        if (!["ON", "OFF"].includes(action)) {
            return NextResponse.json(
                { error: "Invalid action. Must be ON or OFF" },
                { status: 400 }
            );
        }

        // Step 1: Verify authorization via active-session
        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const sessionRes = await fetch(
            `${baseUrl}/api/iot/active-session?instructor_id=${instructor_id}`,
            { cache: "no-store" }
        );
        const sessionData = await sessionRes.json();

        if (!sessionData.authorized) {
            return NextResponse.json(
                { error: "Not authorized — no active session", reason: sessionData.reason },
                { status: 403 }
            );
        }

        // Verify the room_id is in authorized sessions
        const authorizedRoomIds = sessionData.sessions.map(
            (s: { room_id: string }) => s.room_id
        );
        if (!authorizedRoomIds.includes(room_id)) {
            return NextResponse.json(
                { error: "Not authorized for this room" },
                { status: 403 }
            );
        }

        // Step 2: Verify department isolation
        const { data: room } = await supabase
            .from("rooms")
            .select("id, department_id")
            .eq("id", room_id)
            .single();

        const { data: instructor } = await supabase
            .from("instructors")
            .select("department_id")
            .eq("id", instructor_id)
            .single();

        if (!room || !instructor || room.department_id !== instructor.department_id) {
            return NextResponse.json(
                { error: "Cross-department access denied" },
                { status: 403 }
            );
        }

        // Step 3: Fetch all endpoints matching role in this room
        const role = GROUP_ROLE_MAP[group_type];
        const { data: endpoints, error: epError } = await supabase
            .from("device_endpoints")
            .select("id, device_id, dp_code, label")
            .eq("room_id", room_id)
            .eq("role", role);

        if (epError) throw epError;

        if (!endpoints || endpoints.length === 0) {
            return NextResponse.json(
                { error: `No ${group_type} endpoints found in this room` },
                { status: 404 }
            );
        }

        // Step 4: Send Tuya commands for each endpoint
        const value = action === "ON";
        const results: Array<{
            endpoint_id: string;
            device_id: string;
            dp_code: string;
            success: boolean;
            error?: string;
        }> = [];

        // De-duplicate by actual device_id (base ID without _ch2 suffix)
        // Each endpoint may reference a logical device_id but the Tuya API
        // needs the physical device_id
        for (const ep of endpoints) {
            // Extract the real Tuya device ID (remove _ch2, _ch3 suffixes)
            const physicalDeviceId = ep.device_id.replace(/_ch\d+$/, "");

            try {
                const tuyaResult = await tuyaControlDevice(
                    physicalDeviceId,
                    ep.dp_code,
                    value
                );

                // Update iot_devices state
                await supabase
                    .from("iot_devices")
                    .update({
                        current_state: value,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", ep.device_id);

                // Log the command
                await supabase.from("iot_device_logs").insert({
                    device_id: ep.device_id,
                    code: ep.dp_code,
                    value,
                    source: source || "web",
                    triggered_by: instructor_id,
                    class_id: sessionData.primary?.class_id || null,
                });

                results.push({
                    endpoint_id: ep.id,
                    device_id: ep.device_id,
                    dp_code: ep.dp_code,
                    success: tuyaResult?.success !== false,
                });
            } catch (err) {
                results.push({
                    endpoint_id: ep.id,
                    device_id: ep.device_id,
                    dp_code: ep.dp_code,
                    success: false,
                    error: String(err),
                });
            }
        }

        // Step 5: Update session_state for manual override tracking
        const todayStr = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
        )
            .toISOString()
            .slice(0, 10);
        const activeClassId = sessionData.primary?.class_id;

        if (source !== "auto_on" && action === "OFF") {
            // Manual OFF → set manual_override
            await supabase.from("session_state").upsert(
                {
                    department_id: room.department_id,
                    room_id,
                    class_id: activeClassId,
                    session_date: todayStr,
                    manual_override: true,
                    last_changed_by: source || "web",
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "room_id,session_date,class_id" }
            );
        } else if (source === "auto_on") {
            // Auto-on trigger → mark auto_on_done
            await supabase.from("session_state").upsert(
                {
                    department_id: room.department_id,
                    room_id,
                    class_id: activeClassId,
                    session_date: todayStr,
                    auto_on_done: true,
                    last_changed_by: "auto_on",
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "room_id,session_date,class_id" }
            );
        }

        const allSuccess = results.every((r) => r.success);

        return NextResponse.json({
            success: allSuccess,
            group_type,
            action,
            room_id,
            endpoints_controlled: results.length,
            results,
        });
    } catch (err) {
        console.error("[IoT Group Control] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
