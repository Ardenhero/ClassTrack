"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function assignStudent(classId: string, studentId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("enrollments").insert({ class_id: classId, student_id: parseInt(studentId) }); // student_id bigint

    if (error) {
        if (error.code === '23505') return { error: "Student is already enrolled." };
        return { error: error.message };
    }

    revalidatePath(`/classes/${classId}`);
    return { success: true };
}

export async function removeStudent(classId: string, studentId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("enrollments").delete().match({ class_id: classId, student_id: parseInt(studentId) });

    if (error) {
        return { error: error.message };
    }

    revalidatePath(`/classes/${classId}`);
    return { success: true };
}
