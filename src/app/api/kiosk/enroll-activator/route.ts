import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/kiosk/enroll-activator
 * 
 * Website sends this to start fingerprint enrollment for an instructor
 * on a specific kiosk device. Sets pending_command on the kiosk_devices table.
 * The ESP32 picks it up on next sync and enters enrollment mode.
 * 
 * Body: { instructor_id: string, device_serial: string }
 */
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { instructor_id, device_serial } = body;

    if (!instructor_id || !device_serial) {
        return NextResponse.json(
            { error: "instructor_id and device_serial are required" },
            { status: 400 }
        );
    }

    // Verify instructor exists and has room activator permission
    const { data: instructor } = await supabase
        .from("instructors")
        .select("id, name, can_activate_room")
        .eq("id", instructor_id)
        .single();

    if (!instructor) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    if (!instructor.can_activate_room) {
        return NextResponse.json(
            { error: "Instructor does not have Room Activator permission" },
            { status: 403 }
        );
    }

    // Verify kiosk device exists and is approved
    const { data: device } = await supabase
        .from("kiosk_devices")
        .select("device_serial, status")
        .eq("device_serial", device_serial)
        .single();

    if (!device) {
        return NextResponse.json({ error: "Kiosk device not found" }, { status: 404 });
    }

    if (device.status !== "approved") {
        return NextResponse.json(
            { error: "Kiosk device is not approved" },
            { status: 403 }
        );
    }

    // Set the pending command
    const command = `enroll_activator:${instructor_id}:${instructor.name}`;

    const { error } = await supabase
        .from("kiosk_devices")
        .update({ pending_command: command })
        .eq("device_serial", device_serial);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
        action: "enrollment_command_sent",
        entity_type: "kiosk_device",
        entity_id: device_serial,
        details: `Enrollment command sent for instructor ${instructor.name} (${instructor_id}) to kiosk ${device_serial}`,
        performed_by: null,
    });

    return NextResponse.json({
        success: true,
        message: `Enrollment command queued for ${instructor.name}. The kiosk will prompt for fingerprint on next sync.`,
    });
}
