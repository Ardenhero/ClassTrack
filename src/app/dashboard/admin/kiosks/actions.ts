"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

async function requireSuperAdmin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('instructors')
        .select('is_super_admin, role, department_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    return { user, profile, isSuperAdmin: !!profile?.is_super_admin };
}

export async function approveKiosk(deviceSerial: string, departmentId: string | null) {
    const { user, isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({
            status: 'approved',
            department_id: departmentId,
            approved_at: new Date().toISOString(),
            approved_by: user.id,
        })
        .eq('device_serial', deviceSerial);

    if (error) {
        console.error("Error approving kiosk:", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function rejectKiosk(deviceSerial: string) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({ status: 'rejected' })
        .eq('device_serial', deviceSerial);

    if (error) {
        console.error("Error rejecting kiosk:", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function assignKioskDepartment(deviceSerial: string, departmentId: string | null) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({ department_id: departmentId })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function bindKioskToRoom(deviceSerial: string, roomId: string | null) {
    const { isSuperAdmin, profile } = await requireSuperAdmin();

    const supabase = createAdminClient();

    // Super Admins can bind any kiosk. Dept Admins can only bind kiosks in their department.
    if (!isSuperAdmin) {
        // Check department match
        const { data: kiosk } = await supabase
            .from('kiosk_devices')
            .select('department_id')
            .eq('device_serial', deviceSerial)
            .single();

        if (!kiosk || kiosk.department_id !== profile?.department_id) {
            return { success: false, error: "Cannot bind kiosk from another department" };
        }
    }

    const { error } = await supabase
        .from('kiosk_devices')
        .update({ room_id: roomId })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function updateKioskLabel(deviceSerial: string, label: string) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({ label: label || null })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteKiosk(deviceSerial: string) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .delete()
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
