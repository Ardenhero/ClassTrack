import { createClient } from "@/utils/supabase/server";

export type NotificationType = "info" | "warning" | "success" | "neutral" | "error";

export async function createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = "info",
    link?: string
) {
    const supabase = createClient();

    const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
        link,
        read: false,
    });

    if (error) {
        console.error("Failed to create notification:", error);
    }
}
