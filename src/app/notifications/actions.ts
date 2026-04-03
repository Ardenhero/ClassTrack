"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Service role client for operations that need to bypass RLS
function getServiceClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function markAllAsRead() {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Use service role to bypass RLS 
    const admin = getServiceClient();

    // Match how notifications are fetched: by instructor_id (profile) when available
    let query = admin
        .from("notifications")
        .update({ read: true })
        .eq("read", false);

    if (profileId) {
        query = query.eq("instructor_id", profileId);
    } else {
        query = query.eq("user_id", user.id);
    }

    const { error } = await query;
    if (error) console.error("[Notifications] markAllAsRead error:", error);

    revalidatePath("/");
}

export async function deleteNotification(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error("[Notifications] deleteNotification: no user session");
        return;
    }

    // Use service role to bypass RLS
    const admin = getServiceClient();

    // Check if user is Super Admin (they can see and delete any notification)
    const { data: instructor } = await admin
        .from("instructors")
        .select("is_super_admin")
        .eq("auth_user_id", user.id)
        .eq("is_super_admin", true)
        .limit(1)
        .maybeSingle();

    let query = admin
        .from("notifications")
        .delete()
        .eq("id", id);

    // Non-super-admins can only delete their own
    if (!instructor) {
        query = query.eq("user_id", user.id);
    }

    const { error } = await query;

    if (error) {
        console.error("[Notifications] deleteNotification error:", error);
    }

    revalidatePath("/");
}

/**
 * Creates a notification for a specific student.
 * Uses service role to bypass RLS.
 */
export async function createStudentNotification({
    studentId,
    type,
    title,
    message,
    metadata = {}
}: {
    studentId: string | number;
    type: 'no_class' | 'low_attendance' | 'info' | 'message';
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}) {
    const admin = getServiceClient();

    const { error } = await admin.from("notifications").insert({
        student_id: studentId,
        type,
        title,
        message,
        metadata,
    });

    if (error) {
        console.error("[Notifications] createStudentNotification error:", error);
        // If metadata column is missing, retry without it
        if (error.message.includes("metadata")) {
            const { error: retryError } = await admin.from("notifications").insert({
                student_id: studentId,
                type,
                title,
                message,
            });
            if (!retryError) return { success: true };
            return { error: retryError.message };
        }
        return { error: error.message };
    }

    return { success: true };
}

/**
 * Declare a "No Class" day for a specific class and notify all enrolled students.
 */
export async function declareNoClass({
    classId,
    date,
    type,
    note,
    instructorId,
    className
}: {
    classId: string;
    date: string;
    type: string;
    note?: string;
    instructorId: string;
    className: string;
}) {
    const admin = getServiceClient();

    // 1. Create the override
    const { error: overrideError } = await admin.from("class_day_overrides").upsert({
        class_id: classId,
        date: date,
        type: type,
        note: note || null,
        created_by: instructorId,
    }, { onConflict: "class_id,date" });

    if (overrideError) {
        return { error: `Failed to save override: ${overrideError.message}` };
    }

    // 2. Fetch all enrolled students
    const { data: enrollments, error: enrollmentError } = await admin
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId);

    if (enrollmentError) {
        console.error("[Notifications] Fetch enrollments error:", enrollmentError);
        return { error: `Failed to fetch students: ${enrollmentError.message}` };
    }

    if (enrollments && enrollments.length > 0) {
        console.log(`[Notifications] Found ${enrollments.length} enrolled students for class ${classId}`);

        const studentIds = enrollments.map((e: { student_id: string | number }) => e.student_id);
        const notifTitle = `No Class: ${className}`;

        // ✅ DELETE existing notifications for this class+date to prevent duplicates on re-click
        await admin
            .from("notifications")
            .delete()
            .eq("type", "no_class")
            .eq("title", notifTitle)
            .in("student_id", studentIds);

        // 3. Send notifications in bulk (deduplicated)
        const notifications = enrollments.map((e: { student_id: string | number }) => ({
            student_id: e.student_id,
            type: 'no_class' as const,
            title: notifTitle,
            message: `Class for ${date} has been marked as ${type}${note ? ` (${note})` : ""}.`,
        }));

        try {
            const { error: notifyError } = await admin.from("notifications").insert(notifications);
            if (notifyError) {
                console.error("[Notifications] Bulk notify error:", notifyError);
            } else {
                console.log(`[Notifications] Successfully sent ${notifications.length} alerts.`);
            }
        } catch (err) {
            console.error("[Notifications] Unexpected bulk insert error:", err);
        }
    } else {
        console.warn("[Notifications] No students enrolled in class:", classId);
    }

    revalidatePath("/");
    return { success: true };
}

/**
 * Remove a "No Class" declaration (Undo).
 */
export async function removeNoClass({
    classId,
    date
}: {
    classId: string;
    date: string;
}) {
    const admin = getServiceClient();

    // Delete the override
    const { error } = await admin
        .from("class_day_overrides")
        .delete()
        .eq("class_id", classId)
        .eq("date", date);

    if (error) {
        return { error: `Failed to remove override: ${error.message}` };
    }

    revalidatePath("/");
    return { success: true };
}

/**
 * Send an announcement to all students enrolled in a specific class.
 */
export async function broadcastAnnouncement({
    classId,
    className,
    title,
    message,
    instructorName
}: {
    classId: string;
    className: string;
    title: string;
    message: string;
    instructorName: string;
}) {
    const admin = getServiceClient();

    // 1. Fetch all enrolled students
    const { data: enrollments, error: enrollmentError } = await admin
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId);

    if (enrollmentError) {
        console.error("[Notifications] Broadcast fetch enrollments error:", enrollmentError);
        return { error: `Failed to fetch students: ${enrollmentError.message}` };
    }

    if (!enrollments || enrollments.length === 0) {
        return { error: "No students enrolled in this class." };
    }

    // 2. Send notifications in bulk
    const notifications = enrollments.map(e => ({
        student_id: e.student_id,
        type: 'message',
        title: title || `Announcement: ${className}`,
        message: message,
        metadata: { classId, className, instructorName, broadcast: true }
    }));

    const { error: notifyError } = await admin.from("notifications").insert(notifications);

    if (notifyError) {
        console.error("[Notifications] Broadcast notify error:", notifyError);
        // If metadata column is missing, retry without it
        if (notifyError.message.includes("metadata")) {
            const legacyNotifications = notifications.map((n: Record<string, unknown>) => {
                const newN = { ...n };
                delete newN.metadata;
                return newN;
            });
            const { error: retryError } = await admin.from("notifications").insert(legacyNotifications);
            if (!retryError) return { success: true };
            return { error: retryError.message };
        }
        return { error: `Failed to send notifications: ${notifyError.message}` };
    }

    return { success: true };
}

/**
 * Send a direct message to a student from an instructor.
 */
export async function sendStudentMessage({
    studentId,
    message,
    instructorName
}: {
    studentId: string | number;
    message: string;
    instructorName: string;
}) {
    return createStudentNotification({
        studentId,
        type: 'message',
        title: `Message from Prof. ${instructorName}`,
        message,
        metadata: { instructorName }
    });
}
