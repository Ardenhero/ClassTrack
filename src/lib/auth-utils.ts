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
    if (profileId === 'admin-profile') return 'admin';

    // Validate UUID format to prevent Postgres errors "invalid input syntax for type uuid"
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileId)) {
        console.warn(`Invalid Profile ID format detected: ${profileId}`);
        return null;
    }

    // If it's a UUID, check the database
    const { data: profileData, error } = await supabase
        .from('instructors')
        .select('role, is_super_admin')
        .eq('id', profileId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile role:", error);
        return null;
    }

    return profileData?.role || null;
}

export async function checkIsSuperAdmin() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) return false;

    // Legacy Admin Profile is ALWAYS Super Admin
    if (profileId === 'admin-profile') return true;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileId)) return false;

    const { data } = await supabase
        .from('instructors')
        .select('is_super_admin')
        .eq('id', profileId)
        .maybeSingle();

    return data?.is_super_admin === true;
}

export async function checkIsAdmin() {
    const supabase = createClient();

    // 1. Check currently selected profile role
    const role = await getProfileRole();
    if (role === 'admin') return true;

    // 2. Check if the logged-in user has ANY admin instructor record
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: adminRecord } = await supabase
            .from('instructors')
            .select('id')
            .eq('auth_user_id', user.id)
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();

        if (adminRecord) return true;
    }

    // 3. Fallback for legacy static ID
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;
    if (profileId === 'admin-profile') return true;

    return false;
}
