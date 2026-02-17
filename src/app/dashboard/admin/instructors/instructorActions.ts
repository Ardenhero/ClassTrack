"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateInstructorDepartment(instructorId: string, departmentId: string | null) {
    const supabase = createClient();

    const { error } = await supabase
        .from('instructors')
        .update({ department_id: departmentId })
        .eq('id', instructorId);

    if (error) {
        console.error("Error updating instructor department:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}
