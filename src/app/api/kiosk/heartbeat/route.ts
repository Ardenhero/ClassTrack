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

        const { device_serial, firmware_version, ip_address, room_id } = result.data;

        // Upsert: create device if new, update heartbeat if existing
        const { error } = await supabase
            .from('kiosk_devices')
            .upsert(
                {
                    device_serial,
                    firmware_version: firmware_version || null,
                    ip_address: ip_address || null,
                    room_id: room_id || null,
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
 * Marks devices as offline if last_heartbeat > 3 minutes ago.
 */
export async function GET(request: Request) {
    // Note: We need the caller's session to scope by department for System Admins.
    const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check auth from cookie/header context
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        // If Bearer token provided (useful for direct API calls), set it
        const token = authHeader.replace('Bearer ', '');
        await userClient.auth.setSession({ access_token: token, refresh_token: '' });
    }

    const { data: { user } } = await userClient.auth.getUser();

    // The service role is used strictly for the system-level updates/bypassing RLS
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let isSuperAdmin = false;
    let deptId = null;

    if (user) {
        const { data: profile } = await adminClient
            .from('instructors')
            .select('is_super_admin, department_id')
            .eq('auth_user_id', user.id)
            .maybeSingle();

        isSuperAdmin = !!profile?.is_super_admin;
        deptId = profile?.department_id;
    } else {
        // Unauthenticated calls (if any) shouldn't be allowed to browse the kiosk list
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
            .order('last_heartbeat', { ascending: false });

        // Scoping logic: System Admins only see kiosks assigned to their department
        if (!isSuperAdmin) {
            if (!deptId) {
                return NextResponse.json({ devices: [] }); // No dept = no visible kiosks
            }
            query = query.eq('department_id', deptId);
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
