"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateInstructorDepartment(instructorId: string, departmentId: string | null) {
    const supabase = createClient();

    const { error } = await supabase
        .from('instructors')
        .update({ department_id: departmentId })
        .eq('id', instructorId);

    if (error) {
        console.error("Error updating instructor department:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}

export async function toggleRoomActivation(instructorId: string, newValue: boolean) {
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
        .from('instructors')
        .update({ can_activate_room: newValue })
        .eq('id', instructorId);

    if (error) {
        console.error("Error toggling room activation:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}

export async function toggleOutsideSchedule(instructorId: string, newValue: boolean) {
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
        .from('instructors')
        .update({ can_activate_outside_schedule: newValue })
        .eq('id', instructorId);

    if (error) {
        console.error("Error toggling outside schedule:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    return { success: true };
}

/**
 * Creates a new instructor record using the Service Role.
 * This ensures that Dept Admins can add instructors even if RLS is restrictive.
 */
export async function createInstructor(data: {
    name: string,
    pin_code: string | null,
    department_id: string | null,
    role: string,
    owner_id: string | null
}) {
    const adminSupabase = createAdminClient();

    const { data: newInstructor, error } = await adminSupabase
        .from('instructors')
        .insert({
            name: data.name,
            pin_code: data.pin_code,
            department_id: data.department_id,
            role: data.role,
            owner_id: data.owner_id,
            is_visible_on_kiosk: true
        })
        .select()
        .single();

    if (error) {
        console.error("[Create Instructor] Error:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");
    
    return { success: true, data: newInstructor };
}

import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function updateInstructorRooms(instructorId: string, roomIds: string[]) {
    // USE SERVICE ROLE: Bypasses RLS to ensure Admins can always update instructors in their department
    const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Filter rooms to ensure only valid UUIDs are being saved (sanitization)
    const validRoomIds = roomIds.filter(id =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );

    console.log(`[IoT Permission] Updating rooms for instructor ${instructorId}:`, validRoomIds);

    const { error } = await supabase
        .from('instructors')
        .update({ assigned_room_ids: validRoomIds })
        .eq('id', instructorId);

    if (error) {
        console.error("Error updating instructor rooms:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/admin/instructors");

    // Verification check
    const { data: verify } = await supabase.from('instructors').select('assigned_room_ids').eq('id', instructorId).single();
    console.log(`[IoT Permission] Verification: Saved ${verify?.assigned_room_ids?.length || 0} rooms for instructor ${instructorId}`);

    return { success: true };
}
