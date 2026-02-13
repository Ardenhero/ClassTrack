import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const EnrollSchema = z.object({
    student_id: z.number().int().positive(),
    device_id: z.string().min(1),
    slot_index: z.number().int().min(1).max(127),
});

export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const result = EnrollSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid request", details: result.error.format() },
                { status: 400 }
            );
        }

        const { student_id, device_id, slot_index } = result.data;

        // Check if slot is already occupied
        const { data: existingSlot } = await supabase
            .from("fingerprint_slots")
            .select("id, student_id")
            .eq("device_id", device_id)
            .eq("slot_index", slot_index)
            .maybeSingle();

        if (existingSlot) {
            return NextResponse.json(
                { error: `Slot ${slot_index} is already occupied on device ${device_id}` },
                { status: 409 }
            );
        }

        // Check if student already has a fingerprint enrolled
        const { data: studentData } = await supabase
            .from("students")
            .select("id, name, fingerprint_slot_id")
            .eq("id", student_id)
            .single();

        if (!studentData) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        if (studentData.fingerprint_slot_id) {
            return NextResponse.json(
                { error: `Student '${studentData.name}' already has fingerprint enrolled at slot ${studentData.fingerprint_slot_id}` },
                { status: 409 }
            );
        }

        // 1. Insert into fingerprint_slots
        const { error: slotError } = await supabase
            .from("fingerprint_slots")
            .insert({
                device_id,
                slot_index,
                student_id,
            });

        if (slotError) {
            console.error("Slot insert error:", slotError);
            return NextResponse.json({ error: slotError.message }, { status: 500 });
        }

        // 2. Update student record
        const { error: studentError } = await supabase
            .from("students")
            .update({
                fingerprint_slot_id: slot_index,
                device_id: device_id,
            })
            .eq("id", student_id);

        if (studentError) {
            console.error("Student update error:", studentError);
            // Rollback slot insert
            await supabase
                .from("fingerprint_slots")
                .delete()
                .eq("device_id", device_id)
                .eq("slot_index", slot_index);
            return NextResponse.json({ error: studentError.message }, { status: 500 });
        }

        console.log(`[Enroll] Student ${studentData.name} (ID: ${student_id}) -> Slot ${slot_index} on ${device_id}`);

        return NextResponse.json({
            success: true,
            message: `Enrolled ${studentData.name} at slot ${slot_index}`,
            student_name: studentData.name,
            slot_index,
        });

    } catch (err) {
        console.error("Enroll API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
