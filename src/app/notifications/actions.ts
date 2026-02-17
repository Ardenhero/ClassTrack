"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Service role client for operations that need to bypass RLS
function getServiceClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function markAllAsRead() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Use service role to bypass RLS 
    const admin = getServiceClient();

    // Match how notifications are fetched: by instructor_id (profile) when available
    let query = admin
        .from("notifications")
        .update({ read: true })
        .eq("read", false);

    if (profileId && profileId !== 'admin-profile') {
        query = query.eq("instructor_id", profileId);
    } else {
        query = query.eq("user_id", user.id);
    }

    const { error } = await query;
    if (error) console.error("[Notifications] markAllAsRead error:", error);

    revalidatePath("/");
}

export async function deleteNotification(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error("[Notifications] deleteNotification: no user session");
        return;
    }

    // Use service role to bypass RLS
    const admin = getServiceClient();

    // Check if user is Super Admin (they can see and delete any notification)
    const { data: instructor } = await admin
        .from("instructors")
        .select("is_super_admin")
        .eq("auth_user_id", user.id)
        .eq("is_super_admin", true)
        .limit(1)
        .maybeSingle();

    let query = admin
        .from("notifications")
        .delete()
        .eq("id", id);

    // Non-super-admins can only delete their own
    if (!instructor) {
        query = query.eq("user_id", user.id);
    }

    const { error } = await query;

    if (error) {
        console.error("[Notifications] deleteNotification error:", error);
    }

    revalidatePath("/");
}
