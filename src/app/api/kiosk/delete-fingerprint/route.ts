import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { device_serial, slot_id } = body;

        if (!device_serial || !slot_id) {
            return NextResponse.json({ error: "Missing device_serial or slot_id" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Queue the delete command on the kiosk
        const { error: cmdError } = await supabase
            .from("kiosk_devices")
            .update({ pending_command: `delete_finger:${slot_id}` })
            .eq("device_serial", device_serial);

        if (cmdError) {
            console.error("Set pending command error:", cmdError);
            return NextResponse.json({ error: "Failed to set pending command" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Delete command queued" });
    } catch (e: any) {
        console.error("Delete fingerprint error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
