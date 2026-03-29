import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Helper: Get strict 12:00 AM start of current day in Manila as UTC ISO
function getTodayStartUTC() {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    const localDateStr = formatter.format(new Date());
    return new Date(`${localDateStr}T00:00:00.000+08:00`).toISOString();
}

/**
 * POST /api/qr/session/approve — Approve scans and log attendance.
 * Body: { session_id, scan_ids?: string[] }
 * If scan_ids omitted, approves ALL pending scans for the session.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { session_id, scan_ids } = await request.json();

        if (!session_id) {
            return NextResponse.json({ error: "session_id is required" }, { status: 400 });
        }

        // Fetch session details
        const { data: session } = await supabase
            .from('qr_sessions')
            .select('id, class_id, action, instructor_id, classes(id, start_time, end_time, instructors!classes_instructor_id_fkey(user_id))')
            .eq('id', session_id)
            .single();

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Get pending scans to approve
        let query = supabase
            .from('qr_scans')
            .select('id, student_id, scanned_at, students(id, name)')
            .eq('session_id', session_id)
            .eq('status', 'pending');

        if (scan_ids && scan_ids.length > 0) {
            query = query.in('id', scan_ids);
        }

        const { data: scans } = await query;

        if (!scans || scans.length === 0) {
            return NextResponse.json({ success: true, approved: 0, message: "No pending scans to approve." });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const classRef = session.classes as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetOwnerId = Array.isArray(classRef?.instructors) ? classRef.instructors[0]?.user_id : classRef?.instructors?.user_id;

        const isTimeOut = session.action === 'check_out';
        const todayStart = getTodayStartUTC();

        const getMinutes = (t: string | null) => {
            if (!t) return 0;
            const p = t.split(':').map(Number);
            return p[0] * 60 + p[1];
        };

        let approvedCount = 0;
        let skippedCount = 0;

        for (const scan of scans) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const studentId = (scan.students as any)?.id || scan.student_id;

            if (isTimeOut) {
                // Find today's open attendance log for this student+class
                const { data: openLog } = await supabase
                    .from('attendance_logs')
                    .select('id, status')
                    .eq('student_id', studentId)
                    .eq('class_id', session.class_id)
                    .is('time_out', null)
                    .gte('timestamp', todayStart)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!openLog) {
                    skippedCount++;
                    continue; // No open session to time out
                }

                // Calculate status for time-out
                let status = openLog.status;
                const scanDate = new Date(scan.scanned_at);
                const nowManila = scanDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
                const currentMinutes = getMinutes(nowManila);
                if (status !== 'Absent' && classRef?.end_time) {
                    const endM = getMinutes(classRef.end_time);
                    const nowM = currentMinutes;
                    // Cutting class if scan is more than 15 minutes before end_time
                    if ((endM - nowM) > 15) status = 'Absent';
                    // Ghosting check (already handled by session expiry, but for safety)
                    if ((nowM - endM) > 60) status = 'Absent';
                }

                await supabase
                    .from('attendance_logs')
                    .update({ time_out: scan.scanned_at, status, entry_method: 'qr_verified' })
                    .eq('id', openLog.id);

                approvedCount++;
            } else {
                // Time In — check for duplicate
                const { data: existingLog } = await supabase
                    .from('attendance_logs')
                    .select('id')
                    .eq('student_id', studentId)
                    .eq('class_id', session.class_id)
                    .gte('timestamp', todayStart)
                    .limit(1)
                    .maybeSingle();

                if (existingLog) {
                    skippedCount++;
                    continue; // Already timed in
                }

                // Calculate status (Present/Late/Absent)
                let status = 'Present';
                const scanDate = new Date(scan.scanned_at);
                const nowManila = scanDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
                const currentMinutes = getMinutes(nowManila);
                if (classRef?.start_time) {
                    const startM = getMinutes(classRef.start_time);
                    const delta = currentMinutes - startM;
                    if (delta >= 20) status = 'Absent';
                    else if (delta >= 16) status = 'Late';
                }

                await supabase.from('attendance_logs').insert({
                    student_id: studentId,
                    class_id: session.class_id,
                    user_id: targetOwnerId,
                    status,
                    timestamp: scan.scanned_at,
                    entry_method: 'qr_verified',
                });

                approvedCount++;
            }

            // Mark scan as approved
            await supabase
                .from('qr_scans')
                .update({ status: 'approved' })
                .eq('id', scan.id);
        }

        return NextResponse.json({
            success: true,
            approved: approvedCount,
            skipped: skippedCount,
            message: `${approvedCount} student(s) approved.${skippedCount > 0 ? ` ${skippedCount} skipped (duplicate/no open session).` : ''}`,
        });

    } catch (err) {
        console.error("[QR Approve] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/qr/session/approve — Reject a scan or close a session.
 * Body: { scan_id } — Reject individual scan
 *   OR: { session_id } — Close entire session
 */
export async function DELETE(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { scan_id, session_id, scan_ids } = await request.json();

        if (scan_id || (Array.isArray(scan_ids) && scan_ids.length > 0)) {
            // Reject individual or multiple scans
            let query = supabase
                .from('qr_scans')
                .update({ status: 'rejected' });

            if (scan_id) {
                query = query.eq('id', scan_id);
            } else {
                query = query.in('id', scan_ids);
            }

            const { error } = await query;

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, action: 'rejected' });
        }

        if (session_id) {
            // Close session
            const { error } = await supabase
                .from('qr_sessions')
                .update({ status: 'closed', closed_at: new Date().toISOString() })
                .eq('id', session_id);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, action: 'session_closed' });
        }

        return NextResponse.json({ error: "scan_id or session_id required" }, { status: 400 });

    } catch (err) {
        console.error("[QR Reject] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
