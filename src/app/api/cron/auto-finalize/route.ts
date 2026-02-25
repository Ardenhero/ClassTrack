import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Auto-Finalize Attendance (Cron Route)
 * 
 * Runs after class hours (e.g., 9 PM daily via Vercel Cron).
 * For each class that had at least 2 students scan today:
 *   - Finds enrolled students who did NOT scan
 *   - Auto-inserts "Absent" records for them
 *   - Skips classes that are suspended (class_day_overrides)
 * 
 * Can also be triggered manually: GET /api/cron/auto-finalize?secret=YOUR_SECRET
 * 
 * Environment Variables:
 * - CRON_SECRET: protects endpoint from unauthorized access
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get today's date in Manila timezone
    const now = new Date();
    const manilaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const todayStr = manilaDate.toISOString().split("T")[0];
    const startOfDay = `${todayStr}T00:00:00+08:00`;
    const endOfDay = `${todayStr}T23:59:59+08:00`;

    // Get all active classes (not archived)
    const { data: classes } = await supabase
        .from("classes")
        .select("id, name, end_time")
        .eq("is_archived", false);

    if (!classes || classes.length === 0) {
        return NextResponse.json({ message: "No active classes", finalized: 0 });
    }

    // Check for suspended classes today
    const { data: suspensions } = await supabase
        .from("class_day_overrides")
        .select("class_id")
        .eq("date", todayStr);

    const suspendedClassIds = new Set((suspensions || []).map(s => s.class_id));

    let totalFinalized = 0;
    let totalAbsentMarked = 0;
    const results: Array<{ className: string; absentMarked: number }> = [];

    for (const cls of classes) {
        // Skip suspended classes
        if (suspendedClassIds.has(cls.id)) continue;

        // Skip classes that haven't ended yet (if end_time is set)
        if (cls.end_time) {
            const [endH, endM] = cls.end_time.split(":").map(Number);
            const currentH = manilaDate.getHours();
            const currentM = manilaDate.getMinutes();
            if (currentH < endH || (currentH === endH && currentM < endM)) {
                continue; // Class hasn't ended yet
            }
        }

        // Get today's attendance logs for this class
        const { data: todayLogs } = await supabase
            .from("attendance_logs")
            .select("student_id")
            .eq("class_id", cls.id)
            .gte("timestamp", startOfDay)
            .lte("timestamp", endOfDay);

        const presentStudentIds = new Set((todayLogs || []).map(l => l.student_id));

        // Need at least 2 students scanned to auto-finalize (prevents accidental triggers)
        if (presentStudentIds.size < 2) continue;

        // Get enrolled students for this class
        const { data: enrollments } = await supabase
            .from("enrollments")
            .select("student_id")
            .eq("class_id", cls.id);

        if (!enrollments) continue;

        // Find absent students (enrolled but didn't scan)
        const absentStudentIds = enrollments
            .map(e => e.student_id)
            .filter(id => !presentStudentIds.has(id));

        if (absentStudentIds.length === 0) continue;

        // Check if we already finalized (don't double-mark)
        const { count: existingAbsent } = await supabase
            .from("attendance_logs")
            .select("id", { count: "exact", head: true })
            .eq("class_id", cls.id)
            .eq("status", "Absent")
            .gte("timestamp", startOfDay)
            .lte("timestamp", endOfDay);

        if (existingAbsent && existingAbsent > 0) continue; // Already finalized

        // Insert Absent records
        const absentRecords = absentStudentIds.map(studentId => ({
            student_id: studentId,
            class_id: cls.id,
            status: "Absent",
            timestamp: `${todayStr}T${cls.end_time || "17:00:00"}+08:00`,
            method: "auto-finalize",
        }));

        const { error } = await supabase
            .from("attendance_logs")
            .insert(absentRecords);

        if (!error) {
            totalFinalized++;
            totalAbsentMarked += absentStudentIds.length;
            results.push({
                className: cls.name,
                absentMarked: absentStudentIds.length,
            });
        }
    }

    // Audit log
    if (totalFinalized > 0) {
        await supabase.from("audit_logs").insert({
            action: "auto_finalize_attendance",
            entity_type: "system",
            entity_id: todayStr,
            details: `Auto-finalized ${totalFinalized} classes, marked ${totalAbsentMarked} students absent`,
            performed_by: null, // System action
        });
    }

    return NextResponse.json({
        date: todayStr,
        classesFinalized: totalFinalized,
        totalAbsentMarked,
        results,
    });
}
