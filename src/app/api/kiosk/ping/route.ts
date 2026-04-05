import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * POST /api/kiosk/ping — Admin triggers a diagnostic ping to a kiosk.
 * Sets pending_command = 'ping' on the kiosk_devices row.
 * The ESP32 will detect this on its next heartbeat and respond.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { device_serial, command } = await request.json();
        const validCommands = ['ping', 'pin', 'pair', 'reboot', 'sync'];
        const cmd = validCommands.includes(command) ? command : 'ping';

        if (!device_serial) {
            return NextResponse.json(
                { error: "device_serial is required" },
                { status: 400 }
            );
        }

        // Set pending command on device directly
        const { error } = await supabase
            .from('kiosk_devices')
            .update({ pending_command: cmd })
            .eq('device_serial', device_serial);

        if (error) {
            console.error("[Ping] Update error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Ping queued for ${device_serial}. Device will respond on next heartbeat.`,
        });

    } catch (err) {
        console.error("[Ping] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
