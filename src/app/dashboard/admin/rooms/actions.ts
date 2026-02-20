import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { checkIsSuperAdmin } from "@/lib/auth-utils";

export async function createRoom(formData: FormData) {
    const supabase = createClient();
    const name = formData.get("name") as string;
    const building = formData.get("building") as string;
    const capacityStr = formData.get("capacity") as string;
    const capacity = capacityStr ? parseInt(capacityStr, 10) : null;
    const departmentIdStr = formData.get("department_id") as string;
    const department_id = departmentIdStr ? departmentIdStr : null;

    const { error } = await supabase.from("rooms").insert({
        name,
        building: building || null,
        capacity,
        department_id
    });

    if (error) {
        console.error("Error creating room:", error);
    }
    revalidatePath("/dashboard/admin/rooms");
}

export async function updateRoomDetails(roomId: string, name: string, building: string) {
    const supabase = createClient();
    const { error } = await supabase.from("rooms").update({ name, building }).eq("id", roomId);
    if (error) {
        console.error("Error updating room:", error);
    }
    revalidatePath("/dashboard/admin/rooms");
}

export async function assignDeviceToRoom(deviceId: string, roomId: string | null) {
    const supabase = createClient();
    const { error } = await supabase.from("iot_devices").update({ room_id: roomId }).eq("id", deviceId);
    if (error) {
        console.error("Error assigning device to room:", error);
    }
    revalidatePath("/dashboard/admin/rooms");
}
