import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const EnrollSchema = z.object({
    student_id: z.number().int().positive().optional(),
    instructor_id: z.string().uuid().optional(),
    device_id: z.string().min(1),
    slot_index: z.number().int().min(1).max(127),
}).refine(data => data.student_id !== undefined || data.instructor_id !== undefined, {
    message: "Either student_id or instructor_id must be provided"
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

        const { student_id, instructor_id, device_id, slot_index } = result.data;

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

        let targetName = "";

        if (instructor_id) {
            // Check if instructor already has an activator fingerprint enrolled
            const { data: instructorData } = await supabase
                .from("instructors")
                .select("id, name, activator_fingerprint_slot")
                .eq("id", instructor_id)
                .single();

            if (!instructorData) {
                return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
            }

            if (instructorData.activator_fingerprint_slot) {
                return NextResponse.json(
                    { error: `Instructor '${instructorData.name}' already has an activator fingerprint enrolled at slot ${instructorData.activator_fingerprint_slot}` },
                    { status: 409 }
                );
            }
            targetName = instructorData.name;
        } else if (student_id) {
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
            targetName = studentData.name;
        }

        // 1. Insert into fingerprint_slots (Note: we only link student_id physically for now)
        const { error: slotError } = await supabase
            .from("fingerprint_slots")
            .insert({
                device_id,
                slot_index,
                student_id: student_id || null, // Keep null for instructors if column only accepts ints
            });

        if (slotError) {
            console.error("Slot insert error:", slotError);
            return NextResponse.json({ error: slotError.message }, { status: 500 });
        }

        // 2. Update specific table record
        if (instructor_id) {
            const { error: instError } = await supabase
                .from("instructors")
                .update({
                    activator_fingerprint_slot: slot_index,
                    activator_device_serial: device_id,
                })
                .eq("id", instructor_id);

            if (instError) {
                console.error("Instructor update error:", instError);
                await supabase.from("fingerprint_slots").delete().eq("device_id", device_id).eq("slot_index", slot_index);
                return NextResponse.json({ error: instError.message }, { status: 500 });
            }
        } else if (student_id) {
            const { error: studentError } = await supabase
                .from("students")
                .update({
                    fingerprint_slot_id: slot_index,
                    device_id: device_id,
                })
                .eq("id", student_id);

            if (studentError) {
                console.error("Student update error:", studentError);
                await supabase.from("fingerprint_slots").delete().eq("device_id", device_id).eq("slot_index", slot_index);
                return NextResponse.json({ error: studentError.message }, { status: 500 });
            }
        }

        console.log(`[Enroll] Entity ${targetName} -> Slot ${slot_index} on ${device_id}`);

        return NextResponse.json({
            success: true,
            message: `Enrolled ${targetName} at slot ${slot_index}`,
            student_name: targetName,
            slot_index,
        });

    } catch (err) {
        console.error("Enroll API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
