"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteAccount() {
    const supabase = createClient();

    // Call the secure RPC function to delete the authenticated user
    const { error } = await supabase.rpc('delete_own_user');

    if (error) {
        console.error("Error deleting account:", error);
        return { error: error.message };
    }

    // Sign out to clean up session
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
}

export async function deleteProfile() {
    const supabase = createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: "Unauthenticated" };
    }

    // Call the newly created RPC function to delete the profile and related data
    // This handles cleanup of dependent rows and avoids RLS/FK issues
    const { error } = await supabase.rpc('delete_own_instructor_profile');

    if (error) {
        console.error("Error deleting profile:", error);
        return { error: error.message };
    }

    // Sign out after successful deletion
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
}

export async function togglePin(instructorId: string, enabled: boolean) {
    const supabase = createClient();
    const { error } = await supabase
        .from('instructors')
        .update({ pin_enabled: enabled })
        .eq('id', instructorId);

    if (error) {
        console.error("Error toggling PIN:", error);
        return { error: error.message };
    }

    revalidatePath("/identity");
    return { success: true };
}
