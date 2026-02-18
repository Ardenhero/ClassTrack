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
    const department_id = formData.get("department_id") as string;

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
            department_id: department_id || null,
            current_state: false,
            online: true
        });

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    return { success: true };
}
