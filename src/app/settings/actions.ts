"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

export async function startNewSemester(data: { name: string; start_date: string; end_date: string }) {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return { error: "Not authorized" };

    // Set all existing to inactive
    await supabase.from("semesters").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert new active semester
    const { error } = await supabase.from("semesters").insert({
        ...data,
        is_active: true
    });

    if (error) return { error: error.message };

    revalidatePath("/settings");
    revalidatePath("/classes");
    revalidatePath("/students");
    return { success: true };
}

export async function endCurrentSemester(semesterId: string) {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return { error: "Not authorized" };

    // 1. Mark semester as inactive
    const { error: semError } = await supabase
        .from("semesters")
        .update({ is_active: false })
        .eq("id", semesterId);

    if (semError) return { error: semError.message };

    // 2. Archive all active classes
    await supabase
        .from("classes")
        .update({ is_archived: true })
        .eq("is_archived", false);

    // 3. Archive all active students (using a direct bypass or the secure RPC per student)
    // To do it in bulk for all students in the system safely, we do a direct update.
    // However, RLS students restricts this unless we use service_role. We can use service_role here 
    // because this is a system admin wide action.
    const adminSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await adminSupabase
        .from("students")
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: profileId
        })
        .eq("is_archived", false);

    // 4. Audit log
    await adminSupabase.from("audit_logs").insert({
        action: "semester_ended",
        entity_type: "system",
        entity_id: semesterId,
        details: "Ended semester and mass-archived all classes and students",
        performed_by: profileId
    });

    revalidatePath("/settings");
    revalidatePath("/classes");
    revalidatePath("/students");
    return { success: true };
}
