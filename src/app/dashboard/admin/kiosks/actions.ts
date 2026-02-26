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

export async function approveKiosk(deviceSerial: string, assignedAdminId: string | null) {
    const { user, isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({
            status: 'approved',
            assigned_admin_id: assignedAdminId,
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

export async function assignKioskToAdmin(deviceSerial: string, assignedAdminId: string | null) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({ assigned_admin_id: assignedAdminId })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

import { revalidatePath } from 'next/cache';

export async function bindKioskToRoom(deviceSerial: string, roomId: string | null) {
    const { isSuperAdmin, user } = await requireSuperAdmin();

    const supabase = createAdminClient();

    // Super Admins can bind any kiosk. Dept Admins can only bind kiosks assigned to them.
    if (!isSuperAdmin) {
        // Check admin assignment match
        const { data: kiosk } = await supabase
            .from('kiosk_devices')
            .select('assigned_admin_id')
            .eq('device_serial', deviceSerial)
            .single();

        if (!kiosk || kiosk.assigned_admin_id !== user.id) {
            return { success: false, error: "Cannot bind a kiosk not assigned to you" };
        }
    }

    const { error } = await supabase
        .from('kiosk_devices')
        .update({ room_id: roomId })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    revalidatePath('/dashboard/admin/kiosks');
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

export async function updateKioskPin(deviceSerial: string, pin: string) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden" };

    const supabase = createAdminClient();

    // Validate PIN is exactly 4 digits
    if (!/^\d{4}$/.test(pin)) {
        return { success: false, error: "PIN must be exactly 4 digits." };
    }

    const { error } = await supabase
        .from('kiosk_devices')
        .update({ admin_pin: pin })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
