import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice, getDeviceStatus } from "@/lib/tuya";

export const dynamic = "force-dynamic";

/**
 * POST /api/iot/control — Send ON/OFF command to a Tuya device.
 * Body: { device_id, code, value, source?, instructor_id?, room_id?, class_id?, profile_id? }
 *
 * Authorization flow:
 * 1. If instructor_id + room_id provided → full authorization check (schedule + department)
 * 2. If only email (legacy ESP32) → resolve instructor and check schedule
 * 3. Falls through with warning log if no auth context (preserves backward compat)
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");

        const body = await request.json();
        const {
            device_id,
            code,
            value,
            source,
            class_id,
            profile_id,
            instructor_id,
            room_id,
        } = body;

        if (!device_id || !code || typeof value !== "boolean") {
            return NextResponse.json(
                { error: "Missing required fields: device_id, code, value (boolean)" },
                { status: 400 }
            );
        }

        // ========================================
        // AUTHORIZATION
        // ========================================
        let resolvedInstructorId: string | null = instructor_id || profile_id || null;

        // Resolve from email (ESP32 legacy)
        if (email && !resolvedInstructorId) {
            const { data: instructor } = await supabase
                .from("instructors")
                .select("id")
                .eq("email", email)
                .single();
            resolvedInstructorId = instructor?.id || null;
        }

        // If we have an instructor ID, run authorization check
        if (resolvedInstructorId) {
            const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const sessionRes = await fetch(
                `${baseUrl}/api/iot/active-session?instructor_id=${resolvedInstructorId}`,
                { cache: "no-store" }
            );
            const sessionData = await sessionRes.json();

            if (!sessionData.authorized) {
                return NextResponse.json(
                    {
                        error: "Not authorized — no active session",
                        reason: sessionData.reason,
                    },
                    { status: 403 }
                );
            }

            // If room_id provided, verify it's authorized
            if (room_id) {
                const authorizedRoomIds = sessionData.sessions.map(
                    (s: { room_id: string }) => s.room_id
                );
                if (!authorizedRoomIds.includes(room_id)) {
                    return NextResponse.json(
                        { error: "Not authorized for this room" },
                        { status: 403 }
                    );
                }
            }

            // Verify the device belongs to an authorized room
            const { data: endpoint } = await supabase
                .from("device_endpoints")
                .select("room_id")
                .eq("device_id", device_id)
                .eq("dp_code", code)
                .maybeSingle();

            if (endpoint) {
                const authorizedRoomIds = sessionData.sessions.map(
                    (s: { room_id: string }) => s.room_id
                );
                if (!authorizedRoomIds.includes(endpoint.room_id)) {
                    return NextResponse.json(
                        { error: "Device not in your authorized room" },
                        { status: 403 }
                    );
                }
            }
        } else {
            console.warn(
                "[IoT Control] No instructor context — running without authorization"
            );
        }

        // ========================================
        // SEND COMMAND TO TUYA
        // ========================================
        const realDeviceId = device_id.replace(/_ch\d+$/, "");
        const result = await controlDevice(realDeviceId, code, value);

        if (!result.success) {
            return NextResponse.json(
                { error: "Tuya command failed", details: result.msg },
                { status: 502 }
            );
        }

        // Update device state in DB
        await supabase
            .from("iot_devices")
            .update({ current_state: value, updated_at: new Date().toISOString() })
            .eq("id", device_id);

        // Log the command
        await supabase.from("iot_device_logs").insert({
            device_id,
            code,
            value,
            source: source || "web",
            triggered_by: resolvedInstructorId,
            class_id: class_id || null,
        });

        return NextResponse.json({ success: true, device_id, code, value });
    } catch (err) {
        console.error("[IoT Control] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/iot/control?instructor_id=...&room_id=...
 * Returns device statuses. If instructor_id + room_id provided,
 * returns only room-scoped devices. Otherwise falls back to all.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get("room_id");

        let query = supabase.from("iot_devices").select("*").order("name");

        // Room-scoped filtering if parameters provided
        if (roomId) {
            query = query.eq("room_id", roomId);
        }

        const { data: devices, error } = await query;
        if (error) throw error;

        // Refresh from Tuya for each device
        const enriched = await Promise.all(
            (devices || []).map(
                async (device: {
                    id: string;
                    name: string;
                    type: string;
                    room: string;
                    dp_code: string;
                    current_state: boolean;
                    online: boolean;
                }) => {
                    try {
                        const realId = device.id.replace(/_ch\d+$/, "");
                        const status = await getDeviceStatus(realId);
                        if (status.success && status.data) {
                            const switchDp = status.data.find(
                                (dp: Record<string, unknown>) =>
                                    dp.code === (device.dp_code || "switch_1")
                            );
                            return {
                                ...device,
                                current_state: switchDp
                                    ? Boolean(switchDp.value)
                                    : device.current_state,
                                live: true,
                            };
                        }
                    } catch {
                        // Fall back to DB state
                    }
                    return { ...device, live: false };
                }
            )
        );

        return NextResponse.json({
            devices: enriched,
            room_scoped: !!roomId,
        });
    } catch (err) {
        console.error("[IoT Control GET] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
