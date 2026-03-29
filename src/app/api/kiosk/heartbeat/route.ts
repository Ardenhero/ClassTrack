import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const HeartbeatSchema = z.object({
    device_serial: z.string().min(1),
    firmware_version: z.string().optional(),
    ip_address: z.string().optional(),
    room_id: z.string().uuid().optional(),
});

/**
 * POST /api/kiosk/heartbeat — ESP32 heartbeat packet (every 60s)
 * Updates kiosk_devices.last_heartbeat and is_online.
 * Auto-creates the device record if it doesn't exist (self-registration).
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const result = HeartbeatSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid heartbeat payload", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { device_serial, firmware_version, ip_address } = result.data;

        // Instead of upsert (which replaces missing columns with defaults like room_id=null),
        // we manually check if it exists and perform an explicit update or insert.
        const { data: existingDevice } = await supabase
            .from('kiosk_devices')
            .select('device_serial')
            .eq('device_serial', device_serial)
            .maybeSingle();

        const payload = {
            firmware_version: firmware_version || null,
            ip_address: ip_address || null,
            last_heartbeat: new Date().toISOString(),
            is_online: true,
        };

        if (existingDevice) {
            // Update existing device (only touches specified columns, keeping room_id safe)
            const { error } = await supabase
                .from('kiosk_devices')
                .update(payload)
                .eq('device_serial', device_serial);

            if (error) {
                console.error("[Heartbeat] Update error:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        } else {
            // Insert new device
            const { error } = await supabase
                .from('kiosk_devices')
                .insert({
                    device_serial,
                    ...payload,
                });

            if (error) {
                console.error("[Heartbeat] Insert error:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        // Check for pending commands and admin_pin
        const { data: device } = await supabase
            .from('kiosk_devices')
            .select('pending_command, admin_pin')
            .eq('device_serial', device_serial)
            .single();

        let pendingCommand = device?.pending_command || null;
        const adminPin = device?.admin_pin || "1234";

        // One-shot delivery for legacy command
        if (pendingCommand) {
            await supabase
                .from('kiosk_devices')
                .update({ pending_command: null })
                .eq('device_serial', device_serial);
        } else {
            // Check the new robust command queue if legacy is empty
            const { data: queueCmd } = await supabase
                .from('kiosk_commands')
                .select('id, command')
                .eq('device_serial', device_serial)
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (queueCmd) {
                pendingCommand = queueCmd.command;
                // Mark as delivered
                await supabase
                    .from('kiosk_commands')
                    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
                    .eq('id', queueCmd.id);
            }
        }

        // Fetch provisioning status
        const { data: deviceStatus } = await supabase
            .from('kiosk_devices')
            .select('status, room_id, label')
            .eq('device_serial', device_serial)
            .single();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            pending_command: pendingCommand,
            admin_pin: adminPin,
            provisioning: {
                status: deviceStatus?.status || 'pending',
                room_id: deviceStatus?.room_id || null,
                label: deviceStatus?.label || null,
            },
        });

    } catch (err) {
        console.error("[Heartbeat] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/kiosk/heartbeat — Get all kiosk device statuses
 * Used by the Admin Dashboard to display device health.
 * Marks devices as offline if last_heartbeat > 2 minutes ago.
 */
export async function GET() {
    // Use the cookie-based SSR client to read the caller's session
    const { createClient: createSSRClient } = await import("@/utils/supabase/server");
    const userClient = createSSRClient();

    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The service role client bypasses RLS for admin-level queries
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if the caller is a Super Admin
    const { data: profile } = await adminClient
        .from('instructors')
        .select('is_super_admin')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    const isSuperAdmin = !!profile?.is_super_admin;

    try {
        // Fetch all devices with room info
        let query = adminClient
            .from('kiosk_devices')
            .select('*, rooms(name, building)')
            .order('is_online', { ascending: false })
            .order('label');

        // Scoping logic: System Admins only see kiosks assigned to them
        if (!isSuperAdmin) {
            query = query.filter('assigned_admin_ids', 'cs', `{${user.id}}`);
        }

        const { data: devices, error } = await query;

        if (error) throw error;

        return NextResponse.json({ devices: devices || [] });

    } catch (err) {
        console.error("[Heartbeat GET] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
