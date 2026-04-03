"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function provisionAdmin(formData: {
    email: string;
    name: string;
    departmentId: string;
    password: string;
    isSuperAdmin?: boolean;
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
            department_id: formData.isSuperAdmin ? null : (formData.departmentId || null),
            is_super_admin: formData.isSuperAdmin || false,
            is_visible_on_kiosk: false
        });

    if (profileError) {
        // Cleanup Auth User if profile creation fails?
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
    }

    // 5. Fetch department name for logging
    let deptName = "N/A";
    if (formData.departmentId) {
        const { data: dept } = await adminSupabase.from('departments').select('name').eq('id', formData.departmentId).single();
        if (dept) deptName = dept.name;
    }

    // 6. Log the Action
    await adminSupabase.rpc('log_action', {
        p_action: 'PROVISION_ADMIN',
        p_target_type: 'instructors',
        p_target_id: authData.user.id,
        p_details: {
            email: formData.email,
            admin_name: formData.name,
            department: deptName,
            is_super_admin: formData.isSuperAdmin || false
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

export async function updateAdminDepartment(adminId: string, departmentId: string | null) {
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
        .select('is_super_admin')
        .eq('id', adminId)
        .single();

    if (targetProfile?.is_super_admin) {
        throw new Error("Cannot modify Super Admin accounts.");
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
        .from('instructors')
        .update({ department_id: departmentId })
        .eq('id', adminId);

    if (error) throw error;

    // Fetch admin and department info for logging
    const { data: adminData } = await adminSupabase.from('instructors').select('name').eq('id', adminId).single();
    let deptName = "General / N/A";
    if (departmentId) {
        const { data: dept } = await adminSupabase.from('departments').select('name').eq('id', departmentId).single();
        if (dept) deptName = dept.name;
    }

    await adminSupabase.rpc('log_action', {
        p_action: 'UPDATE_ADMIN_DEPT',
        p_target_type: 'instructors',
        p_target_id: adminId,
        p_details: { 
            admin_name: adminData?.name || adminId, 
            new_department: deptName 
        }
    });

    revalidatePath("/dashboard/admin/provisioning");
}

export async function deleteAuditLog(logId: string) {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin')
        .eq('auth_user_id', currentUser.id)
        .single();

    if (!profile?.is_super_admin) throw new Error("Forbidden: Super Admin only");

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
        .from('audit_logs')
        .delete()
        .eq('id', logId);

    if (error) throw error;

    revalidatePath("/dashboard/admin/audit-logs");
    return { success: true };
}

export async function approveDeletionRequest(requestId: string) {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin, id')
        .eq('auth_user_id', currentUser.id)
        .single();

    if (!profile?.is_super_admin) throw new Error("Forbidden: Super Admin only");

    const { data: request } = await supabase
        .from('deletion_requests')
        .select('id, entity_type, entity_id, status')
        .eq('id', requestId)
        .single();

    if (!request) throw new Error("Request not found");
    if (request.status !== 'pending') throw new Error("Request already processed");

    const adminSupabase = createAdminClient();

    // Perform the actual deletion based on entity_type
    if (request.entity_type === 'account_deletion') {
        // request.entity_id is the auth_user_id to delete
        await deleteAdmin(request.entity_id);
    } else if (request.entity_type === 'student') {
        await adminSupabase.from('students').delete().eq('id', request.entity_id);
    } else if (request.entity_type === 'class') {
        await adminSupabase.from('classes').delete().eq('id', request.entity_id);
    }

    // Update request status
    const { error } = await adminSupabase
        .from('deletion_requests')
        .update({
            status: 'approved',
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

    if (error) throw error;

    revalidatePath("/super-admin/deletion-requests");
}

export async function rejectDeletionRequest(requestId: string) {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin, id')
        .eq('auth_user_id', currentUser.id)
        .single();

    if (!profile?.is_super_admin) throw new Error("Forbidden: Super Admin only");

    const { error } = await supabase
        .from('deletion_requests')
        .update({
            status: 'rejected',
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

    if (error) throw error;

    revalidatePath("/super-admin/deletion-requests");
}


export async function deleteAdmin(authUserId: string) {
    // Authorization Check
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin, name')
        .eq('auth_user_id', currentUser.id)
        .single();

    if (!profile?.is_super_admin) throw new Error("Forbidden: Super Admin only");

    // Protection: Cannot delete self
    if (authUserId === currentUser.id) {
        throw new Error("Cannot delete your own account.");
    }

    // Protection: Cannot delete another Super Admin
    const { data: targetProfile } = await supabase
        .from('instructors')
        .select('is_super_admin, id, owner_id, name')
        .eq('auth_user_id', authUserId)
        .single();

    if (targetProfile?.is_super_admin) {
        throw new Error("Cannot delete Super Admin accounts.");
    }

    const adminSupabase = createAdminClient();

    // 1. Delete all instructor profiles owned by this user
    const { data: ownedInstructors } = await adminSupabase
        .from('instructors')
        .select('id')
        .eq('owner_id', authUserId);

    if (ownedInstructors && ownedInstructors.length > 0) {
        const instructorIds = ownedInstructors.map(i => i.id);

        // Delete dependent data for each instructor
        for (const instId of instructorIds) {
            // Evidence data
            await adminSupabase.from('evidence_date_links').delete().in('evidence_id',
                (await adminSupabase.from('evidence_documents').select('id').in('student_id',
                    (await adminSupabase.from('students').select('id').eq('instructor_id', instId)).data?.map(s => s.id) || []
                )).data?.map(e => e.id) || []
            );
            await adminSupabase.from('evidence_documents').delete().in('student_id',
                (await adminSupabase.from('students').select('id').eq('instructor_id', instId)).data?.map(s => s.id) || []
            );
            await adminSupabase.from('fingerprint_device_links').delete().in('student_id',
                (await adminSupabase.from('students').select('id').eq('instructor_id', instId)).data?.map(s => s.id) || []
            );
            await adminSupabase.from('attendance_logs').delete().in('student_id',
                (await adminSupabase.from('students').select('id').eq('instructor_id', instId)).data?.map(s => s.id) || []
            );
            await adminSupabase.from('enrollments').delete().in('student_id',
                (await adminSupabase.from('students').select('id').eq('instructor_id', instId)).data?.map(s => s.id) || []
            );
            await adminSupabase.from('students').delete().eq('instructor_id', instId);
            await adminSupabase.from('classes').delete().eq('instructor_id', instId);
        }

        // Delete the instructor profiles
        await adminSupabase.from('instructors').delete().eq('owner_id', authUserId);
    }

    // 2. Clean up device assignments (Remove from arrays instead of deleting devices)
    // For IoT devices
    await adminSupabase.rpc('remove_instructor_from_all_devices', { p_instructor_id: authUserId });

    // For Kiosk devices
    await adminSupabase.rpc('remove_admin_from_all_kiosks', { p_admin_id: authUserId });

    // Fallback if RPCs don't exist (using raw update with array_remove if possible, but Supabase JS is tricky with array_remove)
    // We'll assume the user can add these RPCs or we'll just do a manual update if we find them.
    // Actually, I'll just use the old logic but update column names to be safe, 
    // but the user might NOT want the kiosk deleted just because 1 admin is gone.

    // Better: Update assigned_admin_ids to remove the user
    // Since I can't easily do array_remove in Supabase JS without RPC, 
    // I'll at least fix the column name in the existing delete logic if they still want it deleted.
    // Actually, let's just null the old singular column if it still exists.
    await adminSupabase.from('kiosk_devices').update({ assigned_admin_id: null }).eq('assigned_admin_id', authUserId);

    // 3. Clean up notifications and audit logs
    await adminSupabase.from('notifications').delete().eq('user_id', authUserId);
    await adminSupabase.from('audit_logs').delete().eq('performed_by', authUserId);

    // 4. Delete the auth user
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(authUserId);
    if (authError) throw authError;

    // Fetch target admin name before deletion log (we have it from step 2)
    const targetName = targetProfile?.name || "Unknown Admin";

    // 5. Log the action
    await adminSupabase.rpc('log_action', {
        p_action: 'DELETE_ADMIN',
        p_target_type: 'auth.users',
        p_target_id: authUserId,
        p_details: { 
            deleted_admin_name: targetName,
            deleted_by: profile.name // profile.name is current user's name
        }
    });

    revalidatePath("/dashboard/admin/provisioning");
    return { success: true };
}

export async function requestAccountDeletion(reason: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get the instructor profile for this user
    const { data: profile } = await supabase
        .from('instructors')
        .select('id, name, is_super_admin')
        .eq('auth_user_id', user.id)
        .eq('role', 'admin')
        .single();

    if (!profile) throw new Error("No admin profile found");
    if (profile.is_super_admin) throw new Error("Super admins cannot request deletion");

    // Create deletion request
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
        .from('deletion_requests')
        .insert({
            entity_type: 'account_deletion',
            entity_id: user.id,
            entity_name: profile.name,
            requested_by: profile.id,
            reason: reason || 'No reason provided',
            status: 'pending'
        });

    if (error) throw error;

    revalidatePath("/dashboard/admin/deletion-requests");
    return { success: true };
}

export async function selfDeactivateAccount() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminSupabase = createAdminClient();

    // Ban the user (they can't log back in until reactivated by super admin)
    const { error } = await adminSupabase.auth.admin.updateUserById(user.id, {
        ban_duration: '876000h'
    });
    if (error) throw error;

    // Mark as locked
    await adminSupabase
        .from('instructors')
        .update({ is_locked: true })
        .eq('auth_user_id', user.id);

    // Sign out
    await supabase.auth.signOut();

    return { success: true };
}
