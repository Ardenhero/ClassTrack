"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Updates the instructor's name in the database using the Service Role.
 * This ensures that name changes for all roles (Instructors, Dept Admins, Super Admins)
 * are successfully synchronized even if RLS is restrictive on the instructors table.
 */
export async function updateInstructorProfileName(instructorId: string, newName: string) {
    const adminSupabase = createAdminClient();

    console.log(`[Profile Sync] Updating name for instructor ${instructorId} to: ${newName}`);

    const { error } = await adminSupabase
        .from('instructors')
        .update({ name: newName })
        .eq('id', instructorId);

    if (error) {
        console.error("[Profile Sync] Error:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/dashboard/admin/instructors");
    
    return { success: true };
}
