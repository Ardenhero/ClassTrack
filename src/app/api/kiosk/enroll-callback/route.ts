import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

/**
 * POST /api/kiosk/enroll-callback
 *
 * Called by ESP32 after successfully enrolling an activator fingerprint.
 * Updates the instructor record with the fingerprint slot.
 *
 * Body: { instructor_id, slot_id, device_serial }
 */
export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const { instructor_id, slot_id, device_serial } = body;

    if (!instructor_id || slot_id === undefined || !device_serial) {
        return NextResponse.json(
            { error: "instructor_id, slot_id, and device_serial are required" },
            { status: 400 }
        );
    }

    // Update instructor with fingerprint info
    const { error } = await supabase
        .from("instructors")
        .update({
            activator_fingerprint_slot: slot_id,
            activator_device_serial: device_serial,
        })
        .eq("id", instructor_id);

    if (error) {
        console.error("[Enroll Callback] Update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clear the pending command since enrollment is complete
    await supabase
        .from("kiosk_devices")
        .update({ pending_command: null })
        .eq("device_serial", device_serial);

    // Audit log
    await supabase.from("audit_logs").insert({
        action: "activator_enrolled",
        entity_type: "instructor",
        entity_id: instructor_id,
        details: `Fingerprint enrolled at slot ${slot_id} on device ${device_serial}`,
        performed_by: null,
    });

    console.log(`[Enroll Callback] Instructor ${instructor_id} enrolled at slot ${slot_id} on ${device_serial}`);

    return NextResponse.json({
        success: true,
        message: `Enrolled at slot ${slot_id}`,
    });
}
