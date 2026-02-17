import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { controlDevice, getDeviceStatus } from "@/lib/tuya";

export const dynamic = 'force-dynamic';

/**
 * POST /api/iot/control — Send ON/OFF command to a Tuya device.
 * Body: { device_id, code, value, source? }
 * Auth: email query param (ESP32 compatible) or service-level trust.
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
        const { device_id, code, value, source, class_id, profile_id } = body;

        if (!device_id || !code || typeof value !== 'boolean') {
            return NextResponse.json(
                { error: "Missing required fields: device_id, code, value (boolean)" },
                { status: 400 }
            );
        }

        // Resolve instructor_id from email (for ESP32 requests) or profile_id (for web requests)
        let triggeredBy: string | null = profile_id || null;
        if (email && !triggeredBy) {
            const { data: instructor } = await supabase
                .from('instructors')
                .select('id')
                .eq('email', email)
                .single();
            triggeredBy = instructor?.id || null;
        }

        // Send command to Tuya
        // For multi-channel devices, DB id may have a suffix like "_ch2"
        // Strip it to get the real Tuya device ID
        const realDeviceId = device_id.replace(/_ch\d+$/, '');
        const result = await controlDevice(realDeviceId, code, value);

        if (!result.success) {
            return NextResponse.json(
                { error: "Tuya command failed", details: result.msg },
                { status: 502 }
            );
        }

        // Update device state in DB
        await supabase
            .from('iot_devices')
            .update({ current_state: value, updated_at: new Date().toISOString() })
            .eq('id', device_id);

        // Log the command
        await supabase
            .from('iot_device_logs')
            .insert({
                device_id,
                code,
                value,
                source: source || 'web',
                triggered_by: triggeredBy,
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
 * GET /api/iot/control — Get current status of all IoT devices.
 */
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { data: devices, error } = await supabase
            .from('iot_devices')
            .select('*')
            .order('name');

        if (error) throw error;

        // Optionally refresh from Tuya for each device
        const enriched = await Promise.all(
            (devices || []).map(async (device: { id: string; name: string; type: string; room: string; dp_code: string; current_state: boolean; online: boolean }) => {
                try {
                    const realId = device.id.replace(/_ch\d+$/, '');
                    const status = await getDeviceStatus(realId);
                    if (status.success && status.data) {
                        const switchDp = status.data.find((dp: Record<string, unknown>) =>
                            dp.code === (device.dp_code || 'switch_1')
                        );
                        return {
                            ...device,
                            current_state: switchDp ? Boolean(switchDp.value) : device.current_state,
                            live: true,
                        };
                    }
                } catch {
                    // Fall back to DB state
                }
                return { ...device, live: false };
            })
        );

        return NextResponse.json({ devices: enriched });

    } catch (err) {
        console.error("[IoT Control GET] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
