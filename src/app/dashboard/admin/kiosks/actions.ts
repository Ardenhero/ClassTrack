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

export async function approveKiosk(deviceSerial: string, assignedAdminIds: string[] | null) {
    const { user, isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({
            status: 'approved',
            assigned_admin_ids: assignedAdminIds || [],
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

export async function assignKioskToAdmin(deviceSerial: string, assignedAdminIds: string[] | null) {
    const { isSuperAdmin } = await requireSuperAdmin();
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('kiosk_devices')
        .update({ assigned_admin_ids: assignedAdminIds || [] })
        .eq('device_serial', deviceSerial);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

import { revalidatePath } from 'next/cache';

export async function bindKioskToRoom(deviceSerial: string, roomId: string | null) {
    const { profile, isSuperAdmin, user } = await requireSuperAdmin();
    const supabase = createAdminClient();

    // 1. Super Admin: Full Access
    if (isSuperAdmin) {
        const { error } = await supabase
            .from('kiosk_devices')
            .update({ room_id: roomId })
            .eq('device_serial', deviceSerial);

        if (error) return { success: false, error: error.message };
        revalidatePath('/dashboard/admin/kiosks');
        return { success: true };
    }

    // 2. Dept Admin: Restricted Access
    if (!profile) return { success: false, error: "Profile not found" };

    // Check if kiosk is assigned to this admin
    const { data: kiosk } = await supabase
        .from('kiosk_devices')
        .select('assigned_admin_ids')
        .eq('device_serial', deviceSerial)
        .single();

    if (!kiosk || !kiosk.assigned_admin_ids?.includes(user.id)) {
        return { success: false, error: "Access Denied: Kiosk not assigned to you" };
    }

    // If assigning to a room, verify room belongs to their department
    if (roomId) {
        const { data: room } = await supabase
            .from('rooms')
            .select('department_id')
            .eq('id', roomId)
            .single();

        if (!room || room.department_id !== profile.department_id) {
            return { success: false, error: "Access Denied: Room does not belong to your department" };
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
    const { isSuperAdmin, user } = await requireSuperAdmin();

    const supabase = createAdminClient();

    // Dept Admins can only rename kiosks assigned to them
    if (!isSuperAdmin) {
        const { data: kiosk } = await supabase
            .from('kiosk_devices')
            .select('assigned_admin_ids')
            .eq('device_serial', deviceSerial)
            .single();

        if (!kiosk || !kiosk.assigned_admin_ids?.includes(user.id)) {
            return { success: false, error: "Cannot rename a kiosk not assigned to you" };
        }
    }

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

    // Only Super Admins can change Kiosk Admin PINs.
    if (!isSuperAdmin) return { success: false, error: "Forbidden: Super Admin only" };

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
