import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const supabase = createClient();

    try {
        const body = await request.json();
        const { student_id, fingerprint_slot_id, device_id } = body;

        if (!student_id || fingerprint_slot_id === undefined) {
            return NextResponse.json(
                { error: "Missing required fields: student_id, fingerprint_slot_id" },
                { status: 400 }
            );
        }

        // Call the RPC function
        const { error } = await supabase.rpc('link_fingerprint', {
            p_student_id: student_id,
            p_slot_id: fingerprint_slot_id,
            p_device_id: device_id || "unknown_device"
        });

        if (error) {
            console.error("Link Fingerprint RPC Error:", error);
            // Check for specific error messages if needed, e.g. "Slot ID ... is already assigned"
            if (error.message.includes("already assigned")) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 409 }
                );
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("Link Fingerprint API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
