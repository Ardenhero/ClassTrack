"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function provisionAdmin(formData: {
    email: string;
    name: string;
    departmentId: string;
    password: string;
}) {
    // 1. Authorization Check (Only Super Admin)
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin')
        .eq('auth_user_id', currentUser.id)
        .single();

    if (!profile?.is_super_admin) throw new Error("Forbidden: Super Admin only");

    // 2. Admin Client (Service Role)
    const adminSupabase = createAdminClient();

    // 3. Create User in Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
            name: formData.name,
            role: 'admin'
        }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user");

    // 4. Create Instructor Profile
    const { error: profileError } = await adminSupabase
        .from('instructors')
        .insert({
            auth_user_id: authData.user.id,
            user_id: authData.user.id,
            owner_id: authData.user.id,
            name: formData.name,
            role: 'admin',
            department_id: formData.departmentId || null,
            is_super_admin: false,
            is_visible_on_kiosk: false
        });

    if (profileError) {
        // Cleanup Auth User if profile creation fails?
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
    }

    // 5. Log the Action
    await adminSupabase.rpc('log_action', {
        p_action: 'PROVISION_ADMIN',
        p_target_type: 'instructors',
        p_target_id: authData.user.id,
        p_details: {
            email: formData.email,
            name: formData.name,
            department_id: formData.departmentId
        }
    });

    revalidatePath("/dashboard/admin/provisioning");
    return { success: true, userId: authData.user.id };
}

export async function toggleAdminStatus(authUserId: string, isLocked: boolean) {
    // Authorization Check
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin')
        .eq('auth_user_id', currentUser.id)
        .single();

    if (!profile?.is_super_admin) throw new Error("Forbidden");

    // Protection: Verify target is NOT a Super Admin
    const { data: targetProfile } = await supabase
        .from('instructors')
        .select('is_super_admin, id')
        .eq('auth_user_id', authUserId)
        .single();

    if (targetProfile?.is_super_admin) {
        throw new Error("Cannot modify Super Admin accounts.");
    }

    const adminSupabase = createAdminClient();

    // Toggle ban/unban status in Auth
    // isLocked = true means we want to LOCK it (ban)
    // isLocked = false means we want to UNLOCK it (unban)
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(authUserId, {
        ban_duration: isLocked ? '876000h' : 'none' // Lock for ~100 years or unlock
    });

    if (authError) throw authError;

    // Update the is_locked state in the instructors table
    const { error: dbError } = await adminSupabase
        .from('instructors')
        .update({ is_locked: isLocked })
        .eq('auth_user_id', authUserId);

    if (dbError) throw dbError;

    revalidatePath("/dashboard/admin/provisioning");
    return { success: true };
}
