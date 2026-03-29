import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { encryptPayload, decryptPayload } from "@/lib/qr-utils";
import crypto from "crypto";
import { getStudentSession } from '@/app/student/portal/actions';
import { createClient as createServerClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/qr/session — Instructor starts a QR attendance session.
 * Body: { class_id, action: 'check_in' | 'check_out' }
 * Returns: encrypted session_token (to render as QR) + session info.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { class_id, action, instructor_id } = await request.json();

        if (!class_id || !action || !instructor_id) {
            return NextResponse.json(
                { error: "class_id, action, and instructor_id are required" },
                { status: 400 }
            );
        }

        // SECURITY CHECK: Verify instructor session
        const supabaseServer = createServerClient();
        const { data: { user } } = await supabaseServer.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!['check_in', 'check_out'].includes(action)) {
            return NextResponse.json(
                { error: "action must be 'check_in' or 'check_out'" },
                { status: 400 }
            );
        }

        // 0. Get Active Term
        const { data: activeTerm } = await supabase
            .from('academic_terms')
            .select('id')
            .eq('is_active', true)
            .maybeSingle();

        // Verify class exists and belongs to active term
        let classQuery = supabase
            .from('classes')
            .select('id, name, start_time, end_time, day_of_week, term_id')
            .eq('id', class_id);
            
        if (activeTerm) {
            classQuery = classQuery.eq('term_id', activeTerm.id);
        } else {
            classQuery = classQuery.is('term_id', null);
        }

        const { data: classData } = await classQuery.single();

        if (!classData) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        // --- ENFORCE SCHEDULING ---
        const nowManila = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const now = new Date(nowManila);
        const currentDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDayName = currentDays[now.getDay()];

        // 1. Day Check
        // Expecting day_of_week like "Mon", "Tue" or "MWF"
        const classDays = classData.day_of_week || "";
        if (!classDays.includes(currentDayName)) {
            return NextResponse.json({ 
                error: "not_scheduled_today", 
                message: `This class is not scheduled for today (${currentDayName}).` 
            }, { status: 403 });
        }

        // 2. Time Window Check
        const getMinutes = (t: string | null) => {
            if (!t) return 0;
            const p = t.split(':').map(Number);
            return p[0] * 60 + p[1];
        };

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startM = getMinutes(classData.start_time);
        const endM = getMinutes(classData.end_time);

        if (action === 'check_in') {
            // Check-in opens 15 mins before start, stays open until end
            if (currentMinutes < (startM - 15) || currentMinutes > endM) {
                return NextResponse.json({ 
                    error: "outside_window", 
                    message: `Time In is only allowed from 15 minutes before class starts until the class ends.` 
                }, { status: 403 });
            }
        } else {
            // Check-out opens 15 mins before end, stays open until 30 mins after end
            if (currentMinutes < (endM - 15) || currentMinutes > (endM + 30)) {
                return NextResponse.json({ 
                    error: "outside_window", 
                    message: "Time Out is only allowed 15 minutes before and up to 30 minutes after class ends." 
                }, { status: 403 });
            }
        }
        // --- END SCHEDULING ---

        // Close any existing open sessions for this class + action
        await supabase
            .from('qr_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('class_id', class_id)
            .eq('instructor_id', instructor_id)
            .eq('action', action)
            .eq('status', 'open');

        // Calculate expires_at: class end_time + 30 minutes (session window)
        let expiresAt: Date;
        if (classData.end_time) {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(new Date());
            const y = parts.find(p => p.type === 'year')!.value;
            const m = parts.find(p => p.type === 'month')!.value;
            const d = parts.find(p => p.type === 'day')!.value;
            const dateStr = `${y}-${m}-${d}`;

            // strictly set to end_time + 30m
            expiresAt = new Date(`${dateStr}T${classData.end_time}+08:00`);
            expiresAt.setMinutes(expiresAt.getMinutes() + 30);
        } else {
            // Fallback for classes without end_time - 2 hours from now
            expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        }

        // Generate unique session token
        const sessionToken = crypto.randomBytes(32).toString('hex');

        // Create session
        const { data: session, error } = await supabase
            .from('qr_sessions')
            .insert({
                class_id,
                instructor_id,
                action,
                status: 'open',
                session_token: sessionToken,
                expires_at: expiresAt.toISOString(),
            })
            .select('id, session_token, created_at, expires_at, action')
            .single();

        if (error) {
            console.error("[QR Session] Create error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Encrypt the session token for the QR code
        const qrPayload = encryptPayload({
            session_id: session.id,
            session_token: sessionToken,
            class_id,
            action,
        });

        return NextResponse.json({
            success: true,
            session_id: session.id,
            qr_payload: qrPayload,
            class_name: classData.name,
            action: session.action,
            expires_at: session.expires_at,
            created_at: session.created_at,
        });

    } catch (err) {
        console.error("[QR Session] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PUT /api/qr/session — Student scans the projected QR code.
 * Body: { qr_payload, student_sin }
 * Inserts a pending scan into qr_scans.
 */
export async function PUT(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { qr_payload, student_sin } = await request.json();

        if (!qr_payload || !student_sin) {
            return NextResponse.json(
                { error: "qr_payload and student_sin are required" },
                { status: 400 }
            );
        }

        // SECURITY CHECK: Verify student session
        const sessionCheck = await getStudentSession();
        if (!sessionCheck || sessionCheck.sin !== student_sin.trim()) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // Decrypt the QR payload
        const decoded = decryptPayload(qr_payload) as {
            session_id: string;
            session_token: string;
            class_id: string;
            action: string;
        } | null;

        if (!decoded || !decoded.session_id || !decoded.session_token) {
            return NextResponse.json(
                { error: "invalid_qr", message: "This is not a valid ClassTrack QR code." },
                { status: 400 }
            );
        }

        // Validate session exists, is open, and token matches
        const { data: session } = await supabase
            .from('qr_sessions')
            .select('id, class_id, action, status, expires_at, session_token')
            .eq('id', decoded.session_id)
            .single();

        if (!session) {
            return NextResponse.json(
                { error: "session_not_found", message: "This QR session no longer exists." },
                { status: 404 }
            );
        }

        if (session.session_token !== decoded.session_token) {
            return NextResponse.json(
                { error: "invalid_token", message: "Invalid QR code." },
                { status: 400 }
            );
        }

        if (session.status !== 'open') {
            return NextResponse.json(
                { error: "session_closed", message: "This attendance session has ended." },
                { status: 410 }
            );
        }

        // Check expiry
        if (new Date(session.expires_at).getTime() < Date.now()) {
            // Auto-close expired session
            await supabase
                .from('qr_sessions')
                .update({ status: 'closed', closed_at: new Date().toISOString() })
                .eq('id', session.id);

            return NextResponse.json(
                { error: "session_expired", message: "This attendance session has expired." },
                { status: 410 }
            );
        }

        // Look up student by SIN
        const { data: student } = await supabase
            .from('students')
            .select('id, name, sin')
            .eq('sin', student_sin.trim())
            .maybeSingle();

        if (!student) {
            return NextResponse.json(
                { error: "student_not_found", message: "Student not found. Check your SIN." },
                { status: 404 }
            );
        }

        // Check enrollment
        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('id')
            .eq('student_id', student.id)
            .eq('class_id', session.class_id)
            .maybeSingle();

        if (!enrollment) {
            return NextResponse.json(
                { error: "not_enrolled", message: "You are not enrolled in this class." },
                { status: 403 }
            );
        }

        // Insert scan (upsert to handle re-scans gracefully)
        const { error: scanError } = await supabase
            .from('qr_scans')
            .upsert(
                {
                    session_id: session.id,
                    student_id: student.id,
                    status: 'pending',
                    scanned_at: new Date().toISOString(),
                },
                { onConflict: 'session_id,student_id' }
            );

        if (scanError) {
            console.error("[QR Scan] Insert error:", scanError);
            return NextResponse.json({ error: scanError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            student_name: student.name,
            action: session.action,
            message: "Scanned successfully! Waiting for instructor approval.",
        });

    } catch (err) {
        console.error("[QR Scan] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * GET /api/qr/session?instructor_id=xxx
 * Fetch active session + pending scans for the instructor.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const instructorId = searchParams.get('instructor_id');

        if (!instructorId) {
            return NextResponse.json({ error: "instructor_id is required" }, { status: 400 });
        }

        // SECURITY CHECK: Verify instructor session
        const supabaseServer = createServerClient();
        const { data: { user } } = await supabaseServer.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Optional: verify user.id matches instructorId or has admin role

        // Find active (open) sessions for this instructor
        const { data: sessions } = await supabase
            .from('qr_sessions')
            .select('id, class_id, action, status, session_token, created_at, expires_at, classes(name)')
            .eq('instructor_id', instructorId)
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        // Auto-close expired sessions
        const now = Date.now();
        const activeSessions = [];
        for (const session of (sessions || [])) {
            if (new Date(session.expires_at).getTime() < now) {
                await supabase
                    .from('qr_sessions')
                    .update({ status: 'closed', closed_at: new Date().toISOString() })
                    .eq('id', session.id);
            } else {
                activeSessions.push(session);
            }
        }

        // For each active session, fetch pending scans with student info
        const sessionsWithScans = await Promise.all(
            activeSessions.map(async (session) => {
                const { data: scans } = await supabase
                    .from('qr_scans')
                    .select('id, student_id, status, scanned_at, students(id, name, sin)')
                    .eq('session_id', session.id)
                    .order('scanned_at', { ascending: true });

                // Re-encrypt the token for QR display
                const qrPayload = encryptPayload({
                    session_id: session.id,
                    session_token: session.session_token,
                    class_id: session.class_id,
                    action: session.action,
                });

                return {
                    ...session,
                    qr_payload: qrPayload,
                    scans: scans || [],
                };
            })
        );

        return NextResponse.json({ sessions: sessionsWithScans });

    } catch (err) {
        console.error("[QR Session GET] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
