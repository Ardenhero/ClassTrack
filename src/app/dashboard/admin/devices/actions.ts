"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDeviceDepartment(deviceId: string, departmentId: string | null) {
    const supabase = createClient();

    const { error } = await supabase
        .from('iot_devices')
        .update({ department_id: departmentId })
        .eq('id', deviceId);

    if (error) {
        console.error("Error updating device department:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/devices");
    return { success: true };
}
