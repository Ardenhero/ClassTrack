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
    console.log("[updateDeviceDetails] Updating:", { deviceId, name, room });

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
        console.error("[updateDeviceDetails] Error:", error);
        return { success: false, error: error.message };
    }

    console.log("[updateDeviceDetails] Update successful");
    revalidatePath("/dashboard/admin/devices");
    revalidatePath("/api/iot/control"); // Ensure frontend sees new names
    return { success: true };
}
