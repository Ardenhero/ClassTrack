"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAllAsRead() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

    revalidatePath("/");
}

export async function deleteNotification(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    revalidatePath("/");
}
