import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    const { device_serial, slot_id } = await req.json();

    if (!device_serial || slot_id === undefined) {
        return NextResponse.json({ error: "device_serial and slot_id are required" }, { status: 400 });
    }

    const command = `delete_finger:${slot_id}`;

    const { error } = await supabase
        .from("kiosk_devices")
        .update({ pending_command: command })
        .eq("device_serial", device_serial);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
