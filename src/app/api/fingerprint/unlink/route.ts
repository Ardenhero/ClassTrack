import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/fingerprint/unlink
 * Clears fingerprint_slot_id from a student record.
 * Used by ESP32 batch sync to auto-cleanup orphaned slots
 * (DB says slot X has data but sensor doesn't).
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const { student_id, fingerprint_slot_id } = body;

        if (!student_id || fingerprint_slot_id === undefined) {
            return NextResponse.json(
                { error: "Missing student_id or fingerprint_slot_id" },
                { status: 400 }
            );
        }

        console.log(`[Unlink] Clearing slot ${fingerprint_slot_id} (student ref: ${student_id})`);

        // Clear the fingerprint_slot_id by matching the slot directly
        const { error, count } = await supabase
            .from('students')
            .update({
                fingerprint_slot_id: null,
                device_id: null,
            })
            .eq('fingerprint_slot_id', fingerprint_slot_id);

        console.log(`[Unlink] Updated ${count} students, error:`, error);

        // Also remove from fingerprint_device_links if exists
        await supabase
            .from('fingerprint_device_links')
            .delete()
            .eq('student_id', student_id)
            .eq('fingerprint_slot_id', fingerprint_slot_id);

        return NextResponse.json({ success: true, cleared_slot: fingerprint_slot_id });

    } catch (err) {
        console.error("[Unlink] Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
