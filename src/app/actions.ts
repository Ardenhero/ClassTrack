"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAttendance(classId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized" };

    // SECURE IDENTITY MAPPING: Ensure user can only mark their OWN attendance
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    if (studentError || !student) {
        console.error("[SECURITY] Unauthorized attendance attempt by user:", user.id);
        return { error: "No student profile linked to this account. Please contact an instructor." };
    }

    const studentId = student.id;

    // Fetch class details to validate window - LEAN SELECTION
    const { data: classDetails } = await supabase
        .from('classes')
        .select('id, start_time, end_time')
        .eq('id', classId)
        .single();

    if (!classDetails) return { error: "Class not found." };

    // Validate Time Window (15m before -> 30m after)
    const now = new Date();
    const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const todayStr = manilaTime.toISOString().split('T')[0];

    const start = new Date(`${todayStr}T${classDetails.start_time}`);
    const attendanceOpen = new Date(start.getTime() - 15 * 60 * 1000);
    const attendanceClose = new Date(start.getTime() + 30 * 60 * 1000);

    if (manilaTime < attendanceOpen) return { error: "Attendance not yet open." };
    if (manilaTime > attendanceClose) return { error: "Attendance period has ended." };

    const { error } = await supabase.rpc('log_attendance_by_fingerprint', {
        p_fingerprint_id: 999
    });

    if (error) {
        // Fallback manual insert if RPC fails or not suitable
        const { error: insertError } = await supabase.from('attendance_logs').insert({
            student_id: studentId,
            timestamp: new Date().toISOString(),
            status: 'Present'
        });

        if (insertError) return { error: "Failed to mark attendance" };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Attendance recorded" };
}
