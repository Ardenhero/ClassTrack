import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const DeleteSchema = z.union([
    z.object({
        device_id: z.string().min(1),
        slot_index: z.number().int().min(1).max(127),
    }),
    z.object({
        student_id: z.number().int().positive(),
    }),
]);

export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const result = DeleteSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Provide either {device_id, slot_index} or {student_id}", details: result.error.format() },
                { status: 400 }
            );
        }

        const data = result.data;

        if ("student_id" in data) {
            // Delete by student_id
            const { data: student } = await supabase
                .from("students")
                .select("id, name, fingerprint_slot_id, device_id")
                .eq("id", data.student_id)
                .single();

            if (!student) {
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }

            if (!student.fingerprint_slot_id) {
                return NextResponse.json({ error: "Student has no fingerprint enrolled" }, { status: 400 });
            }

            // Remove from fingerprint_slots
            await supabase
                .from("fingerprint_slots")
                .delete()
                .eq("student_id", data.student_id);

            // Clear student record
            await supabase
                .from("students")
                .update({ fingerprint_slot_id: null, device_id: null })
                .eq("id", data.student_id);

            console.log(`[Delete] Cleared fingerprint for ${student.name} (slot ${student.fingerprint_slot_id})`);

            return NextResponse.json({
                success: true,
                message: `Cleared fingerprint for ${student.name}`,
                cleared_slot: student.fingerprint_slot_id,
                device_id: student.device_id,
            });

        } else {
            // Delete by device_id + slot_index
            const { data: slot } = await supabase
                .from("fingerprint_slots")
                .select("id, student_id, students(name)")
                .eq("device_id", data.device_id)
                .eq("slot_index", data.slot_index)
                .maybeSingle();

            if (!slot) {
                return NextResponse.json({ error: `Slot ${data.slot_index} is empty on device ${data.device_id}` }, { status: 404 });
            }

            // Remove from fingerprint_slots
            await supabase
                .from("fingerprint_slots")
                .delete()
                .eq("device_id", data.device_id)
                .eq("slot_index", data.slot_index);

            // Clear student record if linked
            if (slot.student_id) {
                await supabase
                    .from("students")
                    .update({ fingerprint_slot_id: null, device_id: null })
                    .eq("id", slot.student_id);
            }

            const studentName = Array.isArray(slot.students)
                ? (slot.students as { name: string }[])[0]?.name
                : (slot.students as { name: string } | null)?.name;

            console.log(`[Delete] Cleared slot ${data.slot_index} on ${data.device_id} (was: ${studentName || 'unknown'})`);

            return NextResponse.json({
                success: true,
                message: `Cleared slot ${data.slot_index}`,
                student_name: studentName || null,
            });
        }

    } catch (err) {
        console.error("Delete Fingerprint API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
