"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteInstructorAction(instructorId: string) {
    const supabase = createClient();

    // Call the RPC that handles cascading deletes and admin check
    const { error } = await supabase.rpc('admin_delete_instructor', {
        p_instructor_id: instructorId
    });

    if (error) {
        console.error("Error deleting instructor:", error);
        return { error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}
