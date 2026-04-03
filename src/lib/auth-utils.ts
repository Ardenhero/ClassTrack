import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * Robust helper to get the role of the current active profile.
 * Handles both legacy "admin-profile" and UUID-based profiles.
 */
export async function getProfileRole() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return null;

    // Validate UUID format to prevent Postgres errors "invalid input syntax for type uuid"
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileId)) {
        console.warn(`Invalid Profile ID format detected: ${profileId}`);
        return null;
    }

    // If it's a UUID, check the database - SECURED: Scope to auth_user_id
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return null;

    const { data: profileData, error } = await supabase
        .from('instructors')
        .select('role, is_super_admin')
        .eq('id', profileId)
        .eq('auth_user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile role:", error);
        return null;
    }

    return profileData?.role || null;
}

/**
 * Get the full profile data for the active profile.
 */
export async function getProfile() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(profileId)) {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) return null;

        const { data, error } = await supabase
            .from('instructors')
            .select('id, name, role, department_id, is_super_admin, assigned_room_ids')
            .eq('id', profileId)
            .eq('auth_user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error("Error fetching full profile:", error);
            return null;
        }
        return data;
    }

    return null;

    return null;
}

export async function checkIsSuperAdmin() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return false;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // CASE 1: Valid UUID Profile ID
    if (uuidRegex.test(profileId)) {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) return false;

        const { data } = await supabase
            .from('instructors')
            .select('is_super_admin')
            .eq('id', profileId)
            .eq('auth_user_id', user.id)
            .maybeSingle();
        return data?.is_super_admin === true;
    }

    return false;

    return false;
}

export async function checkIsAdmin() {
    const supabase = createClient();

    // 1. Check currently selected profile role
    const role = await getProfileRole();
    if (role === 'admin') return true;

    // 2. Check if the logged-in user has ANY admin instructor record
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    return false;
}
