"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// Security constants
const SALT_SIZE = 16;
const KEY_LEN = 64;

/**
 * Hash a password using scrypt
 */
function hashPassword(password: string): string {
    const salt = randomBytes(SALT_SIZE).toString("hex");
    const derivedKey = scryptSync(password, salt, KEY_LEN);
    return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password: string, hash: string): boolean {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = scryptSync(password, salt, KEY_LEN);
    return timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}

export async function loginStudent(formData: FormData) {
    const sin = formData.get("sin")?.toString().trim();
    const password = formData.get("password")?.toString();

    if (!sin || !password) {
        return { error: "SIN and password are required" };
    }

    // Use admin client to bypass RLS for student portal auth
    const supabase = createAdminClient();

    // 1. Find student by SIN
    const { data: student, error } = await supabase
        .from("students")
        .select("id, name, sin, password_hash, year_level, image_url, status:enrollment_status")
        .eq("sin", sin)
        .maybeSingle();

    if (error) {
        console.error("[Login] DB Error:", error);
        return { error: "Database error occurred" };
    }

    if (!student) {
        return { error: "Student not found" };
    }

    // 2. Verify Password
    let isValid = false;
    if (!student.password_hash) {
        // First time login: password must be SIN
        if (password === student.sin) {
            isValid = true;
            // Update password_hash to hash of SIN for security
            const newHash = hashPassword(password);
            await supabase.from("students").update({ password_hash: newHash }).eq("id", student.id);
        }
    } else {
        isValid = verifyPassword(password, student.password_hash);
    }

    if (!isValid) {
        return { error: "Invalid password" };
    }

    // 3. Create Session (Cookie-based)
    const sessionData = JSON.stringify({
        id: student.id,
        name: student.name,
        sin: student.sin,
        year_level: student.year_level,
        image_url: student.image_url,
        role: "student",
        status: student.status, // Added status to session data
        timestamp: Date.now()
    });

    const cookieStore = cookies();
    cookieStore.set("student_session", sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
    });

    return { success: true };
}

export async function getStudentSession() {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("student_session");

    if (!sessionCookie) return null;

    try {
        const session = JSON.parse(sessionCookie.value);
        // Basic validation: check if it's not too old (e.g., 30 days)
        if (Date.now() - session.timestamp > 1000 * 60 * 60 * 24 * 30) {
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

export async function logoutStudent() {
    const cookieStore = cookies();
    cookieStore.delete("student_session");
    return { success: true };
}

export async function updateStudentProfile(formData: FormData) {
    const imageUrl = formData.get("imageUrl")?.toString();
    
    const session = await getStudentSession();
    if (!session) return { error: "Not authenticated" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from("students")
        .update({ image_url: imageUrl })
        .eq("id", session.id);

    if (error) {
        console.error("[UpdateProfile] Error:", error);
        return { error: "Failed to update profile" };
    }

    // Refresh session cookie with new image
    const updatedSession = { ...session, image_url: imageUrl };
    const cookieStore = cookies();
    cookieStore.set("student_session", JSON.stringify(updatedSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
    });

    return { success: true };
}

export async function changeStudentPassword(formData: FormData) {
    const currentPassword = formData.get("currentPassword")?.toString();
    const newPassword = formData.get("newPassword")?.toString();

    if (!currentPassword || !newPassword) {
        return { error: "Current and new passwords are required" };
    }

    const session = await getStudentSession();
    if (!session) return { error: "Not authenticated" };

    const supabase = createAdminClient();
    const { data: student, error } = await supabase
        .from("students")
        .select("id, password_hash")
        .eq("id", session.id)
        .single();

    if (error || !student) return { error: "Student not found" };

    // Verify current
    if (!student.password_hash || !verifyPassword(currentPassword, student.password_hash)) {
        return { error: "Current password incorrect" };
    }

    // Update to new
    const newHash = hashPassword(newPassword);
    const { error: updateError } = await supabase
        .from("students")
        .update({ password_hash: newHash })
        .eq("id", student.id);

    if (updateError) {
        console.error("[ChangePassword] Error:", updateError);
        return { error: "Failed to update password" };
    }

    return { success: true };
}

export async function getStudentNotifications() {
    const session = await getStudentSession();
    if (!session) return { notifications: [] };

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("student_id", session.id) // Use UUID (session.id), NOT SIN string
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("[getStudentNotifications] Error:", error);
        // Fallback: If student_id column is missing, try fetching info notifications (legacy)
        if (error.message.includes("column \"student_id\" does not exist")) {
            const { data: legacyData } = await supabase
                .from("notifications")
                .select("*")
                .eq("type", "info") // or some other criteria
                .limit(5);
            return { notifications: legacyData || [] };
        }
        return { notifications: [] };
    }

    return { notifications: data || [] };
}

export async function markNotificationAsRead(notificationId: string) {
    const session = await getStudentSession();
    if (!session) return { error: "Not authenticated" };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("student_id", session.id); // Use UUID, not SIN

    if (error) {
        console.error("[markNotificationAsRead] Error:", error);
        return { error: "Failed to mark as read" };
    }

    return { success: true };
}

// Absence alerts are now computed client-side from the attendance API stats
// This export is kept for backward compatibility but is no longer called
export async function getStudentAbsenceAlerts() {
    return { alerts: [] };
}

export async function getLatestStudentRecord() {
    const session = await getStudentSession();
    if (!session) return { student: null };

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("students")
        .select("*, status:enrollment_status")
        .eq("id", session.id)
        .single();

    if (error) {
        console.error("[getLatestStudentRecord] Error:", error);
        return { student: null };
    }

    return { student: data };
}
