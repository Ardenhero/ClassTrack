import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/kiosk/sync-templates?device_id=ESP32-LCD7-MAIN
 * Returns all fingerprint_slots for a device with student names.
 * Used by ESP32 on boot to reconcile local sensor memory.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const device_id = searchParams.get("device_id");

        if (!device_id) {
            return NextResponse.json(
                { error: "device_id query parameter is required" },
                { status: 400 }
            );
        }

        // 1. Fetch ALL students with fingerprint slots assigned
        // No device_id filter — the ESP32 sensor scan handles matching
        const { data: allStudents, error: studentErr } = await supabase
            .from('students')
            .select('id, name, fingerprint_slot_id')
            .not('fingerprint_slot_id', 'is', null);

        if (studentErr) {
            console.error("[SyncTemplates] Student query error:", studentErr);
            return NextResponse.json({ error: studentErr.message }, { status: 500 });
        }

        // 2. Fetch copy links from fingerprint_device_links table
        const { data: linkedStudents, error: linkErr } = await supabase
            .from('fingerprint_device_links')
            .select('fingerprint_slot_id, student_id, students!inner(name)')
            .eq('device_serial', device_id);

        if (linkErr) {
            console.error("[SyncTemplates] Link query error:", linkErr);
            return NextResponse.json({ error: linkErr.message }, { status: 500 });
        }

        // 3. Fetch Activator slots from instructors table
        const { data: activatorInstructors, error: activatorErr } = await supabase
            .from('instructors')
            .select('id, name, activator_fingerprint_slot')
            .eq('activator_device_serial', device_id)
            .not('activator_fingerprint_slot', 'is', null);

        if (activatorErr) {
            console.error("[SyncTemplates] Activator query error:", activatorErr);
            return NextResponse.json({ error: activatorErr.message }, { status: 500 });
        }

        // 4. Combine and Deduplicate by slot_index
        type SlotEntry = { slot_index: number; student_id: string; student_name: string; is_activator?: boolean };
        const slotMap = new Map<number, SlotEntry>();

        allStudents?.forEach(s => {
            if (s.fingerprint_slot_id !== null) {
                slotMap.set(s.fingerprint_slot_id, {
                    slot_index: s.fingerprint_slot_id,
                    student_id: s.id,
                    student_name: s.name,
                });
            }
        });



        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkedStudents?.forEach((link: any) => {
            if (!slotMap.has(link.fingerprint_slot_id)) {
                slotMap.set(link.fingerprint_slot_id, {
                    slot_index: link.fingerprint_slot_id,
                    student_id: link.student_id,
                    student_name: link.students?.name || "Unknown",
                });
            }
        });

        activatorInstructors?.forEach(inst => {
            if (inst.activator_fingerprint_slot !== null && !slotMap.has(inst.activator_fingerprint_slot)) {
                slotMap.set(inst.activator_fingerprint_slot, {
                    slot_index: inst.activator_fingerprint_slot,
                    student_id: inst.id,
                    student_name: `${inst.name} (Activator)`,
                    is_activator: true
                });
            }
        });

        // Convert map back to array and explicitly sort by slot_index
        const result = Array.from(slotMap.values()).sort((a, b) => a.slot_index - b.slot_index);

        return NextResponse.json({
            device_id,
            slot_count: result.length,
            slots: result,
        });

    } catch (err) {
        console.error("[SyncTemplates] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
