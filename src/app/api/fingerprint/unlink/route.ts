// src/app/api/fingerprint/unlink/route.ts
//
// Called by ESP32 whenever it deletes a fingerprint from sensor memory.
// Clears fingerprint_slot_id on the matching student row so the web app
// reflects the change in real-time via Supabase Realtime.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fingerprint_slot_id, device_id } = body;

        if (fingerprint_slot_id === undefined || fingerprint_slot_id === null) {
            return NextResponse.json(
                { error: "fingerprint_slot_id is required" },
                { status: 400 }
            );
        }

        const slotId = Number(fingerprint_slot_id);
        if (isNaN(slotId) || slotId < 1 || slotId > 127) {
            return NextResponse.json(
                { error: "fingerprint_slot_id must be 1–127" },
                { status: 400 }
            );
        }

        const supabase = createClient();

        // Find the student currently linked to this slot
        const { data: student, error: findErr } = await supabase
            .from("students")
            .select("id, name, fingerprint_slot_id")
            .eq("fingerprint_slot_id", slotId)
            .maybeSingle();

        if (findErr) {
            console.error("[unlink] DB find error:", findErr);
            return NextResponse.json({ error: findErr.message }, { status: 500 });
        }

        if (!student) {
            // Nothing to unlink — this is fine (e.g. ghost slot)
            console.log(`[unlink] Slot ${slotId} not linked to any student — no-op`);
            return NextResponse.json({
                message: "No student linked to this slot",
                slot_id: slotId,
                unlinked: false,
            });
        }

        // Clear the slot from the student record
        // Setting fingerprint_slot_id to NULL triggers Supabase Realtime UPDATE
        // which causes StudentGrid to call router.refresh() automatically.
        const { error: updateErr } = await supabase
            .from("students")
            .update({ fingerprint_slot_id: null })
            .eq("id", student.id);

        if (updateErr) {
            console.error("[unlink] DB update error:", updateErr);
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        console.log(
            `[unlink] Slot ${slotId} unlinked from student "${student.name}" (id: ${student.id})` +
            (device_id ? ` — device: ${device_id}` : "")
        );

        return NextResponse.json({
            message: "Fingerprint unlinked successfully",
            slot_id: slotId,
            student_id: student.id,
            student_name: student.name,
            unlinked: true,
        });
    } catch (err) {
        console.error("[unlink] Unexpected error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
