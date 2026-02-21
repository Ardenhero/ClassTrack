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

        // Upsert: create device if new, update heartbeat if existing
        // NOTE: room_id is NOT included here — it's managed by the admin UI only.
        // Including it would cause the ESP32 heartbeat to overwrite admin-set room bindings.
        const { error } = await supabase
            .from('kiosk_devices')
            .upsert(
                {
                    device_serial,
                    firmware_version: firmware_version || null,
                    ip_address: ip_address || null,
                    last_heartbeat: new Date().toISOString(),
                    is_online: true,
                },
                { onConflict: 'device_serial' }
            );

        if (error) {
            console.error("[Heartbeat] Upsert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Check for pending commands
        const { data: device } = await supabase
            .from('kiosk_devices')
            .select('pending_command')
            .eq('device_serial', device_serial)
            .single();

        const pendingCommand = device?.pending_command || null;

        // Clear the command after reading it (one-shot delivery)
        if (pendingCommand) {
            await supabase
                .from('kiosk_devices')
                .update({ pending_command: null })
                .eq('device_serial', device_serial);
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
        // First, mark stale devices as offline (heartbeat older than 3 minutes)
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        await adminClient
            .from('kiosk_devices')
            .update({ is_online: false })
            .eq('is_online', true)
            .lt('last_heartbeat', threeMinutesAgo);

        // Fetch all devices with room info
        let query = adminClient
            .from('kiosk_devices')
            .select('*, rooms(name, building)')
            .order('is_online', { ascending: false })
            .order('label');

        // Scoping logic: System Admins only see kiosks assigned directly to them
        if (!isSuperAdmin) {
            query = query.eq('assigned_admin_id', user.id);
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
