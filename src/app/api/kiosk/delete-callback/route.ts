import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { device_serial, slot_id, status } = body;

    if (!device_serial || slot_id === undefined || status !== "success") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    try {
        // 1. Check if it's an instructor activator
        const { data: activator } = await supabase
            .from("instructors")
            .select("id")
            .eq("activator_device_serial", device_serial)
            .eq("activator_fingerprint_slot", slot_id)
            .maybeSingle();

        if (activator) {
            await supabase
                .from("instructors")
                .update({ activator_fingerprint_slot: null, activator_device_serial: null })
                .eq("id", activator.id);
            return NextResponse.json({ success: true, type: "activator" });
        }

        // 2. Check if it's a primary student
        const { data: primaryStudent } = await supabase
            .from("students")
            .select("id")
            .eq("device_id", device_serial)
            .eq("fingerprint_slot_id", slot_id)
            .maybeSingle();

        if (primaryStudent) {
            await supabase
                .from("students")
                .update({ fingerprint_slot_id: null })
                .eq("id", primaryStudent.id);
            // Also notify the frontend to refresh via realtime
            return NextResponse.json({ success: true, type: "primary_student" });
        }

        // 3. Check if it's a copied student link
        const { data: linkedStudent } = await supabase
            .from("fingerprint_device_links")
            .select("student_id")
            .eq("device_serial", device_serial)
            .eq("fingerprint_slot_id", slot_id)
            .maybeSingle();

        if (linkedStudent) {
            await supabase
                .from("fingerprint_device_links")
                .delete()
                .eq("student_id", linkedStudent.student_id)
                .eq("device_serial", device_serial);
            return NextResponse.json({ success: true, type: "linked_student" });
        }

        return NextResponse.json({ success: true, type: "not_found_but_deleted_from_hardware" });
    } catch (err: unknown) {
        console.error("Delete Callback Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
