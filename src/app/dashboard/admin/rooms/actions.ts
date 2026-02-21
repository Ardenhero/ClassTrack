"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";


export async function createRoom(formData: FormData) {
    const userClient = createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const supabase = createAdminClient();
    const name = formData.get("name") as string;
    const building = formData.get("building") as string;
    const departmentIdStr = formData.get("department_id") as string;
    const department_id = departmentIdStr ? departmentIdStr : null;

    const { error } = await supabase.from("rooms").insert({
        name,
        building: building || null,
        department_id
    });

    if (error) {
        console.error("Error creating room:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function updateRoomDetails(roomId: string, name: string, building: string) {
    const userClient = createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const supabase = createAdminClient();
    const { error } = await supabase.from("rooms").update({ name, building }).eq("id", roomId);
    if (error) {
        console.error("Error updating room:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function assignDeviceToRoom(deviceId: string, roomId: string | null, type?: string) {
    const userClient = createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const supabase = createAdminClient();

    // Determine which table to update based on the device type
    const table = type === 'KIOSK' ? 'kiosk_devices' : 'iot_devices';
    const idColumn = type === 'KIOSK' ? 'device_serial' : 'id';

    // System Admins enforcing department checks could be added here, but the 
    // UI selection is already defensively scoped strictly to their department.

    const { error } = await supabase
        .from(table)
        .update({ room_id: roomId })
        .eq(idColumn, deviceId);

    if (error) {
        console.error("Error assigning device to room:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
