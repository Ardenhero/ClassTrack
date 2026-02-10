"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

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

    // Get the current authenticated user (just to verify session)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: "Unauthenticated" };
    }

    // Get the active profile ID from the cookie
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) {
        return { error: "No active profile found to delete." };
    }

    // Call the updated RPC function with the profile ID
    const { error } = await supabase.rpc('delete_active_instructor_profile', {
        p_instructor_id: profileId
    });

    if (error) {
        console.error("Error deleting profile:", error);
        return { error: error.message };
    }

    // Clear the profile cookie
    cookieStore.delete("sc_profile_id");

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
