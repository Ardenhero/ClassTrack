import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";


export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {



    try {
        const body = await req.json();
        const { device_serial, slot_id } = body;

        if (!device_serial || !slot_id) {
            return NextResponse.json({ error: "Missing device_serial or slot_id" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        let command: string;
        if (Array.isArray(slot_id)) {
            // Bulk deletion: join IDs with commas and use delete_bulk: prefix
            command = `delete_bulk:${slot_id.join(',')}`;
        } else {
            // Legacy single deletion
            command = `delete_finger:${slot_id}`;
        }

        // Try to use the robust queue first, fallback to legacy if table is missing
        const { error: cmdError } = await supabase
            .from("kiosk_commands")
            .insert({
                device_serial: device_serial,
                command: command,
                status: 'pending'
            });

        if (cmdError && cmdError.code === '42P01') {
            // Table doesn't exist yet, fallback to legacy field
            console.warn("kiosk_commands table missing, falling back to legacy pending_command");
            const { error: legacyError } = await supabase
                .from("kiosk_devices")
                .update({ pending_command: command })
                .eq("device_serial", device_serial);

            if (legacyError) throw legacyError;
        } else if (cmdError) {
            throw cmdError;
        }

        return NextResponse.json({ success: true, message: "Delete command queued" });
    } catch (e: unknown) {
        console.error("Delete fingerprint error:", e);
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
