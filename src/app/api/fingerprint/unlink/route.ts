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

        const slot = Number(fingerprint_slot_id);
        console.log(`[Unlink] Clearing slot ${slot}`);

        // Use raw SQL via RPC to bypass any type coercion issues
        // Clear from students table
        const { data: studentResult, error: studentErr } = await supabase.rpc('clear_fingerprint_slot', {
            p_slot_id: slot
        });

        console.log(`[Unlink] RPC result:`, studentResult, studentErr);

        // If RPC doesn't exist, fall back to direct updates
        if (studentErr) {
            console.log(`[Unlink] RPC not found, using direct queries`);

            // Try clearing students - cast slot to match column type
            const { data: students } = await supabase
                .from('students')
                .select('id, name, fingerprint_slot_id')
                .filter('fingerprint_slot_id', 'eq', slot);

            console.log(`[Unlink] Found students:`, students);

            if (students && students.length > 0) {
                for (const s of students) {
                    await supabase
                        .from('students')
                        .update({ fingerprint_slot_id: null, device_id: null })
                        .eq('id', s.id);
                    console.log(`[Unlink] Cleared student ${s.name} (${s.id})`);
                }
            }

            // Clean fingerprint_device_links
            const { data: links } = await supabase
                .from('fingerprint_device_links')
                .select('*')
                .filter('fingerprint_slot_id', 'eq', slot);

            console.log(`[Unlink] Found device_links:`, links);

            if (links && links.length > 0) {
                for (const link of links) {
                    await supabase
                        .from('fingerprint_device_links')
                        .delete()
                        .eq('id', link.id);
                    console.log(`[Unlink] Deleted link ${link.id}`);
                }
            }

            // Clean instructor activator slots
            const { data: instructors } = await supabase
                .from('instructors')
                .select('id, name, activator_fingerprint_slot')
                .filter('activator_fingerprint_slot', 'eq', slot);

            if (instructors && instructors.length > 0) {
                for (const inst of instructors) {
                    await supabase
                        .from('instructors')
                        .update({ activator_fingerprint_slot: null, activator_device_serial: null })
                        .eq('id', inst.id);
                    console.log(`[Unlink] Cleared activator ${inst.name}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            cleared_slot: slot,
        });

    } catch (err) {
        console.error("[Unlink] Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
