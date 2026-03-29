import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { device_serial, slot_id, status } = body;

        console.log(`[Delete Callback] Device: ${device_serial}, Slot: ${slot_id}, Status: ${status}`);

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // ALWAYS clear the pending command so the ESP32 doesn't loop
        await supabase
            .from("kiosk_devices")
            .update({ pending_command: null })
            .eq("device_serial", device_serial);

        if (status === "success") {
            // The ESP32 successfully wiped the fingerprint, now sever the database links
            const slotIdInt = parseInt(slot_id, 10);

            // Check if it was an activator first
            const { data: activatorData } = await supabase
                .from('instructors')
                .select('id')
                .eq('activator_fingerprint_slot', slotIdInt)
                .eq('activator_device_serial', device_serial)
                .maybeSingle();

            if (activatorData) {
                await supabase
                    .from("instructors")
                    .update({ activator_fingerprint_slot: null, activator_device_serial: null })
                    .eq("id", activatorData.id);
            } else {
                // Secondary Student Fingerprint Link Check
                await supabase
                    .from("fingerprint_device_links")
                    .delete()
                    .eq("device_serial", device_serial)
                    .eq("slot_id", slotIdInt);

                // Primary Student Fingerprint ID Check
                await supabase
                    .from("students")
                    .update({ fingerprint_slot_id: null })
                    .eq("device_id", device_serial)
                    .eq("fingerprint_slot_id", slotIdInt);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        console.error("Delete callback error:", e);
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
