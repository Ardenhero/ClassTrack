"use server";


import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function updateDeviceDepartment(deviceId: string, departmentId: string | null) {
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
        .from('iot_devices')
        .update({ department_id: departmentId })
        .eq('id', deviceId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    return { success: true };
}

export async function updateDeviceDetails(deviceId: string, name: string, room: string) {
    // Use Service Role to bypass RLS policies
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
        .from('iot_devices')
        .update({ name, room })
        .eq('id', deviceId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    revalidatePath("/api/iot/control"); // Ensure frontend sees new names
    return { success: true };
}

export async function createDevice(formData: FormData) {
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const id = formData.get("id") as string;
    const dp_code = formData.get("dp_code") as string;

    if (!name || !type || !id) {
        return { success: false, error: "Missing required fields" };
    }

    // Use Service Role to bypass RLS policies
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
        .from('iot_devices')
        .insert({
            id, // Valid Tuya ID
            name,
            type,
            dp_code: dp_code || 'switch_1',
            department_id: null, // Always Null (Global) per new plan
            current_state: false,
            online: true
        });

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    return { success: true };
}

export async function updateDeviceInstructors(deviceId: string, instructorIds: string[]) {
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
        .from('iot_devices')
        .update({ assigned_instructor_ids: instructorIds })
        .eq('id', deviceId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    revalidatePath("/api/iot/control");
    return { success: true };
}

export async function deleteDevice(deviceId: string) {
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete dependent logs first
    await adminClient
        .from('iot_device_logs')
        .delete()
        .eq('device_id', deviceId);

    const { error } = await adminClient
        .from('iot_devices')
        .delete()
        .eq('id', deviceId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    revalidatePath("/dashboard/admin/rooms");
    return { success: true };
}
export async function bulkUpdateDeviceInstructors(deviceIds: string[], instructorIds: string[]) {
    // Use Service Role to bypass RLS policies
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Filter out any empty strings or nulls from instructorIds
    const cleanInstructorIds = instructorIds.filter(id => id && id.trim() !== "");

    const { error } = await adminClient
        .from('iot_devices')
        .update({ assigned_instructor_ids: cleanInstructorIds })
        .in('id', deviceIds);

    if (error) {
        console.error("Bulk Assignment Error:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    revalidatePath("/api/iot/control");
    return { success: true };
}

export async function bulkDeleteDevices(deviceIds: string[]) {
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Delete dependent logs first
    await adminClient
        .from('iot_device_logs')
        .delete()
        .in('device_id', deviceIds);

    // 2. Delete the devices
    const { error } = await adminClient
        .from('iot_devices')
        .delete()
        .in('id', deviceIds);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    revalidatePath("/dashboard/admin/rooms");
    return { success: true };
}
