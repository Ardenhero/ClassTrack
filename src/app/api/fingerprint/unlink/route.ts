import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/fingerprint/unlink
 * Clears fingerprint_slot_id from a student record.
 * Used by ESP32 batch sync to auto-cleanup orphaned slots.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const { fingerprint_slot_id } = body;

        if (fingerprint_slot_id === undefined || fingerprint_slot_id === null) {
            return NextResponse.json(
                { error: "Missing fingerprint_slot_id" },
                { status: 400 }
            );
        }

        console.log(`[Unlink] Clearing fingerprint_slot_id=${fingerprint_slot_id}`);

        // 1. Find the student with this slot
        const { data: student } = await supabase
            .from('students')
            .select('id, name')
            .eq('fingerprint_slot_id', fingerprint_slot_id)
            .maybeSingle();

        if (student) {
            console.log(`[Unlink] Found student: ${student.name} (${student.id})`);

            // 2. Clear it
            const { error } = await supabase
                .from('students')
                .update({ fingerprint_slot_id: null, device_id: null })
                .eq('id', student.id);

            if (error) {
                console.error("[Unlink] Update error:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            console.log(`[Unlink] Cleared slot ${fingerprint_slot_id} from ${student.name}`);
        } else {
            console.log(`[Unlink] No student found with slot ${fingerprint_slot_id}`);
        }

        // 3. Also clean fingerprint_device_links
        await supabase
            .from('fingerprint_device_links')
            .delete()
            .eq('fingerprint_slot_id', fingerprint_slot_id);

        // 4. Also clean instructors activator slots
        const { data: instructor } = await supabase
            .from('instructors')
            .select('id, name')
            .eq('activator_fingerprint_slot', fingerprint_slot_id)
            .maybeSingle();

        if (instructor) {
            await supabase
                .from('instructors')
                .update({ activator_fingerprint_slot: null, activator_device_serial: null })
                .eq('id', instructor.id);
            console.log(`[Unlink] Also cleared activator slot from instructor ${instructor.name}`);
        }

        return NextResponse.json({
            success: true,
            cleared_slot: fingerprint_slot_id,
            student_cleared: student?.name || null,
        });

    } catch (err) {
        console.error("[Unlink] Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
