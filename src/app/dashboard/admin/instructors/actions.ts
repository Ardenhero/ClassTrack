"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteInstructorAction(instructorId: string) {
    const supabase = createClient();

    // Call the RPC that handles cascading deletes and admin check
    const { error } = await supabase.rpc('admin_delete_instructor', {
        p_instructor_id: instructorId
    });

    if (error) {
        console.error("Error deleting instructor:", error);
        return { error: error.message };
    }

    // Push refresh_instructors to all approved kiosks robustly via command queue
    const { data: devices } = await supabase
        .from('kiosk_devices')
        .select('device_serial')
        .eq('status', 'approved');

    if (devices && devices.length > 0) {
        const commands = devices.map(d => ({
            device_serial: d.device_serial,
            command: 'refresh_instructors',
            status: 'pending'
        }));
        // We use the same client since deleteInstructorAction is a server action
        await supabase.from('kiosk_commands').insert(commands);
    }

    // Legacy: we can still set one on the device row, but the queue is the primary now.
    // However, heartbeat will pick up the queue first or second depending on legacy state.

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}
