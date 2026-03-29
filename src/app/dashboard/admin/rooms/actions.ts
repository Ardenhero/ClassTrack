"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";


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

export async function assignDeviceToRoom(deviceId: string, roomId: string | null) {
    const userClient = createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const supabase = createAdminClient();
    const { error } = await supabase.from("iot_devices").update({ room_id: roomId }).eq("id", deviceId);
    if (error) {
        console.error("Error assigning device to room:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/rooms");
    revalidatePath("/api/iot/control"); // also ensure devices pull latest room mapping
    return { success: true };
}

export async function toggleRoomAuthorization(roomId: string, adminId: string, isAuthorized: boolean) {
    const userClient = createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const supabase = createAdminClient();

    // Fetch current profile for this admin
    const { data: admin } = await supabase
        .from('instructors')
        .select('assigned_room_ids')
        .eq('id', adminId)
        .single();

    if (!admin) return { success: false, error: "Admin not found" };

    let newRooms = admin.assigned_room_ids || [];
    if (isAuthorized) {
        if (!newRooms.includes(roomId)) {
            newRooms = [...newRooms, roomId];
        }
    } else {
        newRooms = newRooms.filter((id: string) => id !== roomId);
    }

    const { error } = await supabase
        .from('instructors')
        .update({ assigned_room_ids: newRooms })
        .eq('id', adminId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/admin/rooms");
    revalidatePath("/dashboard/admin/provisioning");
    return { success: true };
}
