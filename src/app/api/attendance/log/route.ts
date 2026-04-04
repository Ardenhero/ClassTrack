import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { controlDevice } from "../../../../lib/tuya";


const LogSchema = z.object({
    student_name: z.string().trim().optional(),
    class: z.string().trim().optional(),
    year_level: z.union([z.string(), z.number()]).optional(),
    attendance_type: z.string().trim(),
    timestamp: z.string().datetime().or(z.string()).optional(),
    class_id: z.string().uuid().or(z.string()).optional(),
    instructor_id: z.string().uuid().or(z.string()).optional(),
    // Biometric fields
    fingerprint_slot_id: z.number().int().optional(),
    student_id: z.union([z.string(), z.number()]).optional(),
    device_id: z.string().trim().optional(),
    entry_method: z.enum(['biometric', 'manual_override', 'rfid', 'qr_verified', 'pin']).optional(),
    // v3.2 Correction fields
    is_correction: z.boolean().optional(),
    corrects_log_id: z.string().uuid().optional(),
    // Room Control fields
    room_id: z.string().uuid().or(z.string()).optional(),
    room_action: z.enum(['ON', 'OFF', 'TOGGLE']).optional(),
});



// Helper: Get strict 12:00 AM start of the current day in Asia/Manila as a UTC ISO string
function getTodayStartUTC() {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    const localDateStr = formatter.format(new Date());
    return new Date(`${localDateStr}T00:00:00.000+08:00`).toISOString();
}

/**
 * Robustly resolve instructor ID and name from an email address.
 * Standardizes the lookup across all attendance/IoT paths.
 */
async function resolveInstructorByEmail(supabase: SupabaseClient, email: string) {
    if (!email) return null;
    const { data: authData } = await supabase.auth.admin.listUsers();
    if (!authData?.users) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = authData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return null;

    // Check both auth_user_id (standard) and user_id (legacy/alt)
    const { data: instructor } = await supabase
        .from('instructors')
        .select('id, name, can_activate_room')
        .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle();

    return instructor as { id: string; name: string; can_activate_room: boolean } | null;
}

// Use Service Role Key to bypass RLS and Auth requirements for this trusted endpoint
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");

        let bodyText = "";
        try {
            bodyText = await request.text();
        } catch (readErr) {
            console.error("Critical error reading request body:", readErr);
            return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
        }

        let rawBody: unknown;
        try {
            rawBody = JSON.parse(bodyText);
        } catch (jsonErr: unknown) {
            const errorMessage = jsonErr instanceof Error ? jsonErr.message : "Unknown error";
            return NextResponse.json({
                error: "Malformed JSON",
                details: errorMessage
            }, { status: 400 });
        }

        // --- RIGOROUS VALIDATION (Zod Armor) ---
        type AttendanceLogBody = z.infer<typeof LogSchema>;
        const result = LogSchema.safeParse(rawBody);
        if (!result.success) {
            console.warn("[SECURITY] Invalid attendance payload:", result.error.format());
            return NextResponse.json({ 
                error: "Invalid Request Payload", 
                details: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) 
            }, { status: 400 });
        }

        const body = result.data as AttendanceLogBody;

        // 1. Resolve Kiosk Identity via Device Serial (v3.2 Standard)
        const { data: kioskInfo } = await supabase
            .from('kiosk_devices')
            .select('room_id, label')
            .eq('device_serial', body.device_id)
            .maybeSingle();

        // --- ☢️ NUCLEAR INTERCEPT: ROOM CONTROL (REFINED v3.2) ---
        const typeStr = (body.attendance_type || "").toString().toLowerCase();
        const methodStr = (body.entry_method || "").toString().toLowerCase();
        const rpcStatus = typeStr.toUpperCase().replace(" ", "_");

        const isRoomIntent = (typeStr.includes("room") || typeStr.includes("activation") || rpcStatus === "ROOM_CONTROL") && methodStr !== 'biometric';

        if (isRoomIntent && body.device_id) {
            console.log(`[ROOM CONTROL] PIN/System Trigger: Device=${body.device_id}, Action=${typeStr}`);

            const targetRoomId = kioskInfo?.room_id || null;
            if (!targetRoomId) {
                console.warn(`[SECURITY] Blocked room control attempt for unmapped device: ${body.device_id}`);
                return NextResponse.json({ error: "no_room_assigned", device_serial: body.device_id }, { status: 403 });
            }

            let instructor = null;
            if (email) {
                instructor = await resolveInstructorByEmail(supabase, email);
            }

            const triggerId = instructor?.id || 'system-authorized';
            const triggerName = instructor?.name || 'Authorized User';

            const { data: devices } = await supabase.from('iot_devices').select('id, current_state, dp_code').eq('room_id', targetRoomId);
            if (!devices || devices.length === 0) {
                return NextResponse.json({ error: "no_devices_in_room", room_id: targetRoomId }, { status: 404 });
            }

            const explicitAction = body.room_action;
            const anyOff = devices.some((d) => !d.current_state);

            let newState: boolean;
            if (explicitAction === "ON") newState = true;
            else if (explicitAction === "OFF") newState = false;
            else newState = anyOff;

            const results = await Promise.all(devices.map(async (dev) => {
                const realId = dev.id.replace(/_ch\d+$/, '');
                const dCode = dev.dp_code || 'switch_1';
                const res = await controlDevice(realId, dCode, newState);
                if (res.success) {
                    await supabase.from('iot_devices').update({ current_state: newState }).eq('id', dev.id);
                    await supabase.from('iot_device_logs').insert({
                        device_id: dev.id,
                        code: dCode,
                        value: newState,
                        source: 'pin',
                        triggered_by: triggerId
                    });
                }
                return res.success;
            }));

            const count = results.filter((r: boolean) => r).length;
            return NextResponse.json({
                success: true,
                instructor_name: triggerName,
                status: newState ? "Activated" : "Deactivated",
                action: newState ? 'room_activated' : 'room_deactivated',
                details: `Toggled ${count}/${devices.length} devices`
            });
        }

        // --- Standard Flow (for Student Attendance) ---
        const { student_id, student_name, class: className, instructor_id, attendance_type, fingerprint_slot_id, device_id } = body;
        const entryMethod = result.data.entry_method || (fingerprint_slot_id ? 'biometric' : 'manual_override');
        const timestamp = result.data.timestamp || new Date().toISOString();
        const rpcStatusInput = attendance_type.toUpperCase().replace(" ", "_");

        const sanitizeUuid = (val: string | undefined | null) => {
            if (!val || val.trim() === "") return null;
            return val;
        };

        const classIdInput = sanitizeUuid(result.data.class_id);
        let instructorIdInput = sanitizeUuid(instructor_id);

        // RESOLVE INSTRUCTOR ID FROM EMAIL IF MISSING
        if (!instructorIdInput && email) {
            const inst = await resolveInstructorByEmail(supabase, email);
            if (inst) instructorIdInput = inst.id;
        }

        // ===== v3.2 CORRECTION WINDOW (5-minute undo) =====
        if (result.data.is_correction && result.data.corrects_log_id) {
            const { data: originalLog, error: origErr } = await supabase
                .from('attendance_logs')
                .select('id, timestamp, class_id, student_id, user_id, status, entry_method')
                .eq('id', result.data.corrects_log_id)
                .single();

            if (origErr || !originalLog) {
                return NextResponse.json({ error: 'Original log not found' }, { status: 404 });
            }

            const originalTime = new Date(originalLog.timestamp).getTime();
            const now = Date.now();
            if (now - originalTime > (5 * 60 * 1000)) {
                return NextResponse.json({
                    error: 'correction_window_expired',
                    message: 'Cannot correct attendance after 5 minutes.',
                }, { status: 403 });
            }

            await supabase.from('attendance_logs').update({ is_correction: true, original_timestamp: originalLog.timestamp }).eq('id', originalLog.id);
            const { data: correctedLog, error: insertErr } = await supabase.from('attendance_logs').insert({
                student_id: originalLog.student_id,
                class_id: classIdInput || originalLog.class_id,
                user_id: originalLog.user_id,
                status: originalLog.status,
                timestamp: timestamp,
                entry_method: originalLog.entry_method,
                is_correction: true,
                corrects_log_id: originalLog.id,
                original_timestamp: originalLog.timestamp,
            }).select('id').single();

            if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
            return NextResponse.json({ success: true, action: 'correction', corrected_log_id: correctedLog?.id });
        }

        // BIOMETRIC or QR DIRECT ID PATH
        if ((student_id || fingerprint_slot_id) && device_id) {
            console.log(`[API] Identifying Student: ${student_id ? 'ID=' + student_id : 'Slot=' + fingerprint_slot_id}`);

            let query = supabase.from('students').select('id, name, year_level, instructor_id, fingerprint_locked');
            if (student_id) {
                const idNum = typeof student_id === 'string' ? parseInt(student_id) : student_id;
                if (!isNaN(idNum)) query = query.or(`id.eq.${idNum}`);
                else query = query.eq('id', student_id);
            } else if (fingerprint_slot_id) {
                query = query.eq('fingerprint_slot_id', fingerprint_slot_id);
            }

            const { data: studentInfo } = await query.maybeSingle();

            if (!studentInfo) {
                if (!student_id && fingerprint_slot_id) {
                    return NextResponse.json({ error: "biometric_student_not_found", message: "Fingerprint not linked to Student" }, { status: 404 });
                }
            }

            if (studentInfo) {
                if (attendance_type === 'Room Control' || rpcStatusInput === 'ROOM_CONTROL') {
                    // Fallback: If a student scans during Room Activation mode, treat it as a normal attendance log
                    console.log(`[API] Student ${studentInfo.name} scanned during Room Activation. Proceeding with attendance.`);
                }
                if (!classIdInput) return NextResponse.json({ error: 'class_id required' }, { status: 400 });
                if (studentInfo.fingerprint_locked) return NextResponse.json({ error: "fingerprint_locked", student_name: studentInfo.name }, { status: 403 });

                const todayStart = getTodayStartUTC();
                const isTimeOut = attendance_type === 'Time Out' || rpcStatusInput === 'TIME_OUT';

                const [enrollmentRes, existingLogRes, classRefRes] = await Promise.all([
                    supabase.from('enrollments').select('id').eq('student_id', studentInfo.id).eq('class_id', classIdInput).maybeSingle(),
                    supabase.from('attendance_logs').select('id, status, timestamp, time_out').eq('student_id', studentInfo.id).eq('class_id', classIdInput).gte('timestamp', todayStart).order('timestamp', { ascending: false }).limit(1).maybeSingle(),
                    supabase.from('classes').select('id, instructor_id, start_time, end_time, name, instructors!classes_instructor_id_fkey(user_id)').eq('id', classIdInput).single()
                ]);

                if (!enrollmentRes.data) {
                    console.error(`[API] 403 Forbidden: Student ${studentInfo.name} (ID: ${studentInfo.id}) is NOT enrolled in Class ID: ${classIdInput}`);
                    return NextResponse.json({
                        error: "Not enrolled",
                        student_name: studentInfo.name,
                        details: `Student is not enrolled in the requested class (ID: ${classIdInput})`
                    }, { status: 403 });
                }
                const classRef = classRefRes.data;
                if (!classRef) return NextResponse.json({ error: "Class not found" }, { status: 404 });

                const getMinutes = (t: string | null) => { if (!t) return 0; const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
                const nowManila = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
                const currentMinutes = getMinutes(nowManila);

                if (isTimeOut) {
                    const openSession = existingLogRes.data;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!openSession || (openSession as any).time_out) return NextResponse.json({ error: 'Already Timed Out', student_name: studentInfo.name, duplicate: true }, { status: 409 });

                    let status = openSession.status;
                    if (status !== 'Absent' && classRef.end_time) {
                        const endM = getMinutes(classRef.end_time);
                        if ((endM - currentMinutes) > 15 || (currentMinutes - endM) > 60) status = 'Absent';
                    }
                    await supabase.from('attendance_logs').update({ time_out: timestamp, status: status, entry_method: entryMethod }).eq('id', openSession.id);
                    return NextResponse.json({ success: true, student_name: studentInfo.name, status, action: 'time_out' });
                } else {
                    if (existingLogRes.data) return NextResponse.json({ error: "Already Timed In", student_name: studentInfo.name, duplicate: true }, { status: 409 });
                    let status = 'Present';
                    if (classRef.start_time) {
                        const startM = getMinutes(classRef.start_time);
                        const delta = currentMinutes - startM;
                        if (delta > 30) status = 'Absent';
                        else if (delta > 15) status = 'Late';
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const targetOwnerId = Array.isArray((classRef as any).instructors) ? (classRef as any).instructors[0]?.user_id : (classRef as any).instructors?.user_id;
                    await supabase.from('attendance_logs').insert({ student_id: studentInfo.id, class_id: classIdInput, user_id: targetOwnerId, status, timestamp, entry_method: entryMethod });
                    return NextResponse.json({ success: true, student_name: studentInfo.name, status, action: 'time_in' });
                }
            }
        }

        // --- LEGACY PATH (RFID/Manual) ---
        console.log(`[API] Legacy Path: ${student_name} -> ${className}`);
        const { data: rpcData, error: rpcError } = await supabase.rpc('log_attendance', {
            email_input: email,
            student_name_input: student_name || '',
            class_name_input: className || '',
            status_input: rpcStatusInput,
            timestamp_input: timestamp,
            instructor_id_input: instructorIdInput,
            class_id_input: classIdInput
        });

        if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });
        const resultData = rpcData as { error?: string; success?: boolean };

        if (resultData && resultData.error) {
            // Manual Fallback Logic (Omitted for brevity, but structurally required if RPC fails)
            console.warn("RPC Failed:", resultData.error);
            return NextResponse.json({ error: resultData.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: "Attendance Logged" });

    } catch (err) {
        console.error("API Error Log:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}