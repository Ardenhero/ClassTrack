"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createVirtualGroup(name: string, room_id: string) {
    const { data, error } = await adminClient
        .from('iot_device_groups')
        .insert({ name, room_id })
        .select()
        .single();

    if (error) {
        console.error("Error creating group:", error);
        return { error: error.message };
    }

    revalidatePath('/dashboard/admin/devices');
    return { data };
}

export async function deleteVirtualGroup(groupId: string) {
    const { error } = await adminClient
        .from('iot_device_groups')
        .delete()
        .eq('id', groupId);

    if (error) return { error: error.message };
    
    revalidatePath('/dashboard/admin/devices');
    return { success: true };
}

export async function addMemberToGroup(groupId: string, deviceId: string, dpCode: string) {
    const { data, error } = await adminClient
        .from('iot_group_members')
        .insert({ group_id: groupId, device_id: deviceId, dp_code: dpCode })
        .select()
        .single();

    if (error) return { error: error.message };

    revalidatePath('/dashboard/admin/devices');
    return { data };
}

export async function removeMemberFromGroup(memberId: string) {
    const { error } = await adminClient
        .from('iot_group_members')
        .delete()
        .eq('id', memberId);

    if (error) return { error: error.message };

    revalidatePath('/dashboard/admin/devices');
    return { success: true };
}

export async function getVirtualGroups() {
    const { data, error } = await adminClient
        .from('iot_device_groups')
        .select('*, members:iot_group_members(*)')
        .order('created_at', { ascending: false });

    if (error) return { error: error.message };
    return { data };
}
