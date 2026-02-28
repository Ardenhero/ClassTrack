import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/student/delete
 * Cascade deletes a student: attendance_logs, enrollments, fingerprint data, then student record.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const body = await request.json();
        const { student_id } = body;

        if (!student_id) {
            return NextResponse.json({ error: "Missing student_id" }, { status: 400 });
        }

        // 1. Get student info first
        const { data: student } = await supabase
            .from('students')
            .select('id, name, fingerprint_slot_id')
            .eq('id', student_id)
            .single();

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        console.log(`[DeleteStudent] Deleting ${student.name} (${student.id})`);

        // 2. Delete attendance_logs
        const { count: attendanceCount } = await supabase
            .from('attendance_logs')
            .delete({ count: 'exact' })
            .eq('student_id', student_id);
        console.log(`[DeleteStudent] Deleted ${attendanceCount || 0} attendance logs`);

        // 3. Delete enrollments
        const { count: enrollmentCount } = await supabase
            .from('enrollments')
            .delete({ count: 'exact' })
            .eq('student_id', student_id);
        console.log(`[DeleteStudent] Deleted ${enrollmentCount || 0} enrollments`);

        // 4. Delete fingerprint_device_links
        const { count: linkCount } = await supabase
            .from('fingerprint_device_links')
            .delete({ count: 'exact' })
            .eq('student_id', student_id);
        console.log(`[DeleteStudent] Deleted ${linkCount || 0} device links`);

        // 5. Delete the student record itself
        const { error: deleteErr } = await supabase
            .from('students')
            .delete()
            .eq('id', student_id);

        if (deleteErr) {
            console.error("[DeleteStudent] Error deleting student:", deleteErr);
            return NextResponse.json({ error: deleteErr.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            deleted: student.name,
            cascade: {
                attendance_logs: attendanceCount || 0,
                enrollments: enrollmentCount || 0,
                device_links: linkCount || 0,
                fingerprint_slot_cleared: student.fingerprint_slot_id || null,
            }
        });

    } catch (err) {
        console.error("[DeleteStudent] Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
