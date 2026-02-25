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

export async function toggleRoomActivation(instructorId: string, newValue: boolean) {
    const supabase = createClient();

    const { error } = await supabase
        .from('instructors')
        .update({ can_activate_room: newValue })
        .eq('id', instructorId);

    if (error) {
        console.error("Error toggling room activation:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}

export async function toggleOutsideSchedule(instructorId: string, newValue: boolean) {
    const supabase = createClient();

    const { error } = await supabase
        .from('instructors')
        .update({ can_activate_outside_schedule: newValue })
        .eq('id', instructorId);

    if (error) {
        console.error("Error toggling outside schedule:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}
