import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { controlDevice } from "@/lib/tuya";

const LogSchema = z.object({
    student_name: z.string().optional(),
    class: z.string().optional(),
    year_level: z.union([z.string(), z.number()]).optional(),
    attendance_type: z.string(),
    timestamp: z.string(),
    class_id: z.string().optional(),
    instructor_id: z.string().optional(),
    // Biometric fields
    fingerprint_slot_id: z.number().int().optional(),
    device_id: z.string().optional(),
    entry_method: z.enum(['biometric', 'manual_override', 'rfid', 'qr_verified']).optional(),
    // v3.2 Correction fields
    is_correction: z.boolean().optional(),
    corrects_log_id: z.string().uuid().optional(),
});

// Helper: Insert a scan notification for the instructor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendScanNotification(supabase: any, instructorId: string | null, studentName: string, className: string, status: string, action: string, method: string) {
    if (!instructorId) return;
    try {
        // Look up the instructor's auth_user_id to set user_id on the notification
        const { data: instructor } = await supabase
            .from('instructors')
            .select('auth_user_id')
            .eq('id', instructorId)
            .single();

        const userId = instructor?.auth_user_id || null;
        const emoji = method === 'biometric' ? '🔏' : method === 'qr_verified' ? '📱' : '📝';
        const actionLabel = action === 'time_out' ? 'Time Out' : 'Time In';

        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            instructor_id: instructorId,
            title: `${emoji} ${studentName} — ${actionLabel}`,
            message: `${status} in ${className}`,
            type: status === 'Present' ? 'success' : status === 'Late' ? 'warning' : 'info',
            read: false,
        });

        if (error) {
            console.error('[Notification] DB insert error:', error.message, error.details);
        } else {
            console.log(`[Notification] Sent: ${studentName} ${actionLabel} in ${className}`);
        }
    } catch (err) {
        console.error('[Notification] Insert exception:', err);
    }
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

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const body = await request.json();
        const result = LogSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid Request", details: result.error }, { status: 400 });
        }

        const { student_name, class: className, instructor_id, attendance_type, fingerprint_slot_id, device_id } = result.data;
        const entryMethod = result.data.entry_method || (fingerprint_slot_id ? 'biometric' : 'manual_override');

        // Force Server Time to ensure accuracy and fix Timezone issues
        // (Device might be sending local time as UTC, causing "Tomorrow" bug)
        const timestamp = new Date().toISOString();

        // Fix: Map "Time In" -> "TIME_IN" for RPC consistency
        const rpcStatusInput = attendance_type.toUpperCase().replace(" ", "_");

        // Sanitize UUIDs (Handle empty strings from C++ client)
        // Postgres throws 500 if we pass "" to a UUID parameter
        const sanitizeUuid = (val: string | undefined | null) => {
            if (!val || val.trim() === "") return null;
            return val;
        };

        const classIdInput = sanitizeUuid(result.data.class_id);
        let instructorIdInput = sanitizeUuid(instructor_id);

        // RESOLVE INSTRUCTOR ID FROM EMAIL IF MISSING (Crucial for proper audit logging)
        if (!instructorIdInput && email) {
            const { data: instructor } = await supabase
                .from('instructors')
                .select('id')
                .eq('user_id', (await supabase.from('auth_users_view').select('id').eq('email', email).maybeSingle())?.data?.id) // Ideal path if view exists
                .maybeSingle();

            if (instructor) {
                instructorIdInput = instructor.id;
            } else {
                // Fallback: If auth_users_view not available, try to find instructor by matching email to user?
                // Actually, we can't easily get user_id from email without admin API.
                // BUT we can search instructors table if we stored email? We don't.
                // Wait, we have the user's email. We can try to get the user ID via listUsers if we had admin.
                // But we only have Service Role.
                const { data: userData } = await supabase.auth.admin.listUsers();
                const user = userData.users.find(u => u.email === email);
                if (user) {
                    const { data: inst } = await supabase
                        .from('instructors')
                        .select('id')
                        .eq('user_id', user.id)
                        .maybeSingle();
                    if (inst) instructorIdInput = inst.id;
                }
            }
        }

        // ===== v3.2 CORRECTION WINDOW (5-minute undo) =====
        if (result.data.is_correction && result.data.corrects_log_id) {
            console.log(`[API] Correction Request: Replacing log ${result.data.corrects_log_id}`);

            // Find the original log
            const { data: originalLog, error: origErr } = await supabase
                .from('attendance_logs')
                .select('id, timestamp, class_id, student_id, user_id, status, entry_method')
                .eq('id', result.data.corrects_log_id)
                .single();

            if (origErr || !originalLog) {
                return NextResponse.json({ error: 'Original log not found' }, { status: 404 });
            }

            // Check 5-minute window
            const originalTime = new Date(originalLog.timestamp).getTime();
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (now - originalTime > fiveMinutes) {
                return NextResponse.json({
                    error: 'correction_window_expired',
                    message: 'Cannot correct attendance after 5 minutes. Contact your instructor.',
                }, { status: 403 });
            }

            // Void the original log (mark as corrected)
            await supabase
                .from('attendance_logs')
                .update({
                    is_correction: true,
                    original_timestamp: originalLog.timestamp,
                })
                .eq('id', originalLog.id);

            // Insert replacement log
            const { data: correctedLog, error: insertErr } = await supabase
                .from('attendance_logs')
                .insert({
                    student_id: originalLog.student_id,
                    class_id: classIdInput || originalLog.class_id,
                    user_id: originalLog.user_id,
                    status: originalLog.status,
                    timestamp: timestamp,
                    entry_method: originalLog.entry_method,
                    is_correction: true,
                    corrects_log_id: originalLog.id,
                    original_timestamp: originalLog.timestamp,
                })
                .select('id')
                .single();

            if (insertErr) {
                console.error('[Correction] Insert error:', insertErr);
                return NextResponse.json({ error: insertErr.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                action: 'correction',
                original_log_id: originalLog.id,
                corrected_log_id: correctedLog?.id,
                message: 'Attendance log corrected successfully.',
            });
        }

        // BIOMETRIC PATH: If fingerprint_slot_id is provided, look up student by slot
        if (fingerprint_slot_id && device_id) {
            console.log(`[API] Biometric Attendance: Slot ${fingerprint_slot_id} on ${device_id} [${rpcStatusInput}]`);

            // DIRECT LOOKUP on students table (Matches Identity Tool Logic)
            const { data: studentInfo } = await supabase
                .from('students')
                .select('id, name, year_level, instructor_id, fingerprint_locked')
                .eq('fingerprint_slot_id', fingerprint_slot_id)
                .maybeSingle();

            if (!studentInfo) {
                // Check if this fingerprint belongs to a Room Activator
                const { data: activatorInfo } = await supabase
                    .from('instructors')
                    .select('id, name')
                    .eq('activator_fingerprint_slot', fingerprint_slot_id)
                    .eq('activator_device_serial', device_id)
                    .maybeSingle();

                if (activatorInfo) {
                    console.log(`[API] Activator Recognized: ${activatorInfo.name} (Slot ${fingerprint_slot_id})`);

                    // Trigger IoT Devices for this room
                    // 1. Find the room this device is in
                    const { data: deviceData } = await supabase
                        .from('kiosk_devices')
                        .select('room_id')
                        .eq('device_serial', device_id)
                        .maybeSingle();

                    if (deviceData?.room_id) {
                        try {
                            // Fetch all IoT devices in this room
                            const { data: devices } = await supabase
                                .from('iot_devices')
                                .select('id, current_state, dp_code, metadata')
                                .eq('room_id', deviceData.room_id);

                            if (devices && devices.length > 0) {
                                // Determine if we are turning ON or OFF. 
                                // If attendance_type is "Room Control", we toggle:
                                // Turn ON only if EVERYTHING is currently OFF. Otherwise, turn OFF.
                                const isRoomControl = attendance_type === 'Room Control';
                                const allOff = devices.every(d => !d.current_state);
                                const targetState = isRoomControl ? allOff : (attendance_type === 'Time In' || rpcStatusInput === 'TIME_IN');

                                const updatePromises = devices.map(async (d) => {
                                    // Actually command the physical device using Tuya API
                                    const realDeviceId = d.id.replace(/_ch\d+$/, '');
                                    try {
                                        await controlDevice(realDeviceId, d.dp_code || 'switch_1', targetState);
                                    } catch (err) {
                                        console.error(`[API] Failed to toggle physical Tuya device ${d.id}:`, err);
                                    }

                                    return supabase
                                        .from('iot_devices')
                                        .update({
                                            current_state: targetState,
                                            metadata: {
                                                ...(d.metadata || {}),
                                                last_toggled_by: activatorInfo.id,
                                                last_toggled_at: timestamp,
                                                toggled_via: 'activator_scan'
                                            }
                                        })
                                        .eq('id', d.id);
                                });

                                await Promise.all(updatePromises);
                                console.log(`[API] Toggled ${devices.length} IoT devices to ${targetState ? 'ON' : 'OFF'} in room ${deviceData.room_id}`);

                                // Return successful "Scan OK" feedback for the ESP32 screen
                                return NextResponse.json({
                                    success: true,
                                    student_name: `${activatorInfo.name} (Room ${targetState ? 'ON' : 'OFF'})`,
                                    status: targetState ? 'Power On' : 'Power Off',
                                    action: 'activator_trigger'
                                });
                            } else {
                                return NextResponse.json({
                                    success: true,
                                    student_name: activatorInfo.name,
                                    error: "No IoT devices found in this room",
                                    status: "Active",
                                    action: 'activator_trigger'
                                });
                            }
                        } catch (iotErr) {
                            console.error('[API] Failed to update IoT devices:', iotErr);
                        }
                    }

                    return NextResponse.json({
                        success: true,
                        student_name: activatorInfo.name,
                        status: "Activator Verified",
                        action: 'activator_trigger'
                    });
                }

                console.warn(`[API] Unregistered Fingerprint: Slot ${fingerprint_slot_id} on ${device_id} - No Student Linked`);

                return NextResponse.json({
                    error: "student_not_found",
                    message: `Fingerprint is not linked to any enrolled student.`,
                    slot: fingerprint_slot_id
                }, { status: 404 });
            }

            // Use the class_id from request body
            if (!classIdInput) {
                return NextResponse.json({ error: 'class_id is required for biometric attendance' }, { status: 400 });
            }

            // Reject if fingerprint is locked
            if (studentInfo.fingerprint_locked) {
                console.warn(`[API] BIOMETRIC BLOCKED - FINGERPRINT LOCKED: Slot ${fingerprint_slot_id} on ${device_id} for Student=${studentInfo.id}`);

                await supabase.from('biometric_audit_logs').insert({
                    fingerprint_slot_id,
                    device_id,
                    event_type: 'INVALID_SCAN',
                    details: 'Scan rejected because fingerprint is locked for this student.',
                    metadata: { student_id: studentInfo.id, rpc_status: rpcStatusInput }
                });

                return NextResponse.json({
                    error: "fingerprint_locked",
                    message: `Fingerprint is locked. Please contact your instructor.`,
                    student_name: studentInfo.name
                }, { status: 403 });
            }

            // Verify student is enrolled in this class
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', studentInfo.id)
                .eq('class_id', classIdInput)
                .maybeSingle();

            if (!enrollment) {
                return NextResponse.json({
                    error: `Student '${studentInfo.name}' is not enrolled in this class`,
                    student_name: studentInfo.name
                }, { status: 403 });
            }

            // Duplicate prevention: check if already scanned today for this class
            const todayStart = new Date().toISOString().split('T')[0];

            const isTimeOut = attendance_type === 'Time Out' || rpcStatusInput === 'TIME_OUT';

            if (!isTimeOut) {
                // TIME IN: Block if ANY log exists today for this student+class
                const { data: existingTimeIn } = await supabase
                    .from('attendance_logs')
                    .select('id')
                    .eq('student_id', studentInfo.id)
                    .eq('class_id', classIdInput)
                    .gte('timestamp', todayStart)
                    .limit(1)
                    .maybeSingle();

                if (existingTimeIn) {
                    console.log(`[API] BIOMETRIC DUPLICATE Time In blocked: Student=${studentInfo.id}, Class=${classIdInput}`);
                    return NextResponse.json({
                        error: "Already Timed In",
                        student_name: studentInfo.name,
                        duplicate: true
                    }, { status: 409 });
                }
            }

            // Get class info for grading logic
            const { data: classRef, error: classRefError } = await supabase
                .from('classes')
                .select('id, instructor_id, start_time, end_time, instructors!classes_instructor_id_fkey(user_id)')
                .eq('id', classIdInput)
                .single();

            if (!classRef) {
                console.error(`[API] BIOMETRIC FAIL: Class not found for classIdInput='${classIdInput}'. DB Error:`, classRefError);
                const errorStr = classRefError ? `DB Error: ${classRefError.message}` : "Class not found";
                return NextResponse.json({ error: errorStr }, { status: 404 });
            }

            const getMinutes = (timeStr: string | null | undefined) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':').map(Number);
                if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
                return parts[0] * 60 + parts[1];
            };
            const nowManila = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
            const currentMinutes = getMinutes(nowManila);

            if (attendance_type === 'Time Out' || rpcStatusInput === 'TIME_OUT') {
                // Handle Time Out for biometric
                const { data: openSession } = await supabase.from('attendance_logs')
                    .select('id, status, timestamp')
                    .eq('student_id', studentInfo.id)
                    .eq('class_id', classIdInput)
                    .is('time_out', null)
                    .gte('timestamp', todayStart)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!openSession) {
                    return NextResponse.json({
                        error: 'Already Timed Out',
                        student_name: studentInfo.name,
                        duplicate: true
                    }, { status: 409 });
                }

                let calculatedStatus = openSession.status;
                if (openSession.status !== 'Absent' && classRef.end_time) {
                    const endMinutes = getMinutes(classRef.end_time);
                    if ((endMinutes - currentMinutes) > 15) calculatedStatus = 'Absent';
                    else if ((currentMinutes - endMinutes) > 60) calculatedStatus = 'Absent';
                }

                await supabase.from('attendance_logs')
                    .update({ time_out: timestamp, status: calculatedStatus, entry_method: entryMethod })
                    .eq('id', openSession.id);

                // v3.2: Decrement room occupancy on Time Out
                try {
                    const { data: classRoom } = await supabase.from('classes').select('room_id').eq('id', classIdInput).single();
                    if (classRoom?.room_id) {
                        await supabase.rpc('update_room_occupancy', { p_room_id: classRoom.room_id, p_delta: -1 });
                    }
                } catch (occErr) { console.error('[Occupancy] Decrement error (non-fatal):', occErr); }

                // Send scan notification to instructor
                const classInfo = await supabase.from('classes').select('name, instructor_id').eq('id', classIdInput).single();
                await sendScanNotification(supabase, classInfo.data?.instructor_id, studentInfo.name, classInfo.data?.name || 'Unknown', calculatedStatus, 'time_out', entryMethod);

                return NextResponse.json({ success: true, student_name: studentInfo.name, status: calculatedStatus, action: 'time_out' });
            } else {
                // Handle Time In for biometric
                let calculatedStatus = 'Present';
                if (classRef.start_time) {
                    const startMinutes = getMinutes(classRef.start_time);
                    const delta = currentMinutes - startMinutes;
                    if (delta > 30) calculatedStatus = 'Absent';
                    else if (delta > 15) calculatedStatus = 'Late';
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const targetOwnerId = Array.isArray((classRef as any).instructors)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? (classRef as any).instructors[0]?.user_id || null
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    : ((classRef as any).instructors?.user_id || null);

                const { error: insertErr } = await supabase.from('attendance_logs').insert({
                    student_id: studentInfo.id,
                    class_id: classIdInput,
                    user_id: targetOwnerId,
                    status: calculatedStatus,
                    timestamp: timestamp,
                    entry_method: entryMethod,
                });

                if (insertErr) {
                    console.error('[API] BIOMETRIC INSERT FAIL:', insertErr);
                    return NextResponse.json({ error: `DB Insert Error: ${insertErr.message}` }, { status: 500 });
                }

                // v3.2: Increment room occupancy on Time In
                try {
                    const { data: classRoom } = await supabase.from('classes').select('room_id').eq('id', classIdInput).single();
                    if (classRoom?.room_id) {
                        await supabase.rpc('update_room_occupancy', { p_room_id: classRoom.room_id, p_delta: 1 });
                    }
                } catch (occErr) { console.error('[Occupancy] Increment error (non-fatal):', occErr); }

                // (Auto-ON removed: student scans should not trigger room devices)

                // Send scan notification to instructor
                const classInfo2 = await supabase.from('classes').select('name, instructor_id').eq('id', classIdInput).single();
                await sendScanNotification(supabase, classInfo2.data?.instructor_id, studentInfo.name, classInfo2.data?.name || 'Unknown', calculatedStatus, 'time_in', entryMethod);

                return NextResponse.json({ success: true, student_name: studentInfo.name, status: calculatedStatus, action: 'time_in' });
            }
        }

        // LEGACY PATH: Name-based attendance (manual/device)
        console.log(`[API] Log Attendance: ${student_name} -> ${className} (${classIdInput || 'No ID'}) [${rpcStatusInput}]`);

        // DUPLICATE PREVENTION: Check before RPC call
        if (classIdInput && student_name) {
            const todayStart = new Date().toISOString().split('T')[0];

            // Look up student by name to get student_id for the duplicate check
            const { data: studentCheck } = await supabase
                .from('students')
                .select('id')
                .or(`name.eq."${student_name}",full_name.eq."${student_name}"`)
                .limit(1)
                .maybeSingle();

            if (studentCheck) {
                if (attendance_type === 'Time In') {
                    // Block duplicate Time In
                    const { data: existingTimeIn } = await supabase
                        .from('attendance_logs')
                        .select('id')
                        .eq('student_id', studentCheck.id)
                        .eq('class_id', classIdInput)
                        .gte('timestamp', todayStart)
                        .limit(1)
                        .maybeSingle();

                    if (existingTimeIn) {
                        console.log(`[API] DUPLICATE Time In blocked (Legacy): Student=${studentCheck.id}, Class=${classIdInput}`);
                        return NextResponse.json({
                            error: "Already Timed In",
                            student_name: student_name,
                            duplicate: true
                        }, { status: 409 });
                    }
                } else if (attendance_type === 'Time Out') {
                    // Block duplicate Time Out (no open session = already timed out or never timed in)
                    const { data: openSession } = await supabase
                        .from('attendance_logs')
                        .select('id')
                        .eq('student_id', studentCheck.id)
                        .eq('class_id', classIdInput)
                        .is('time_out', null)
                        .gte('timestamp', todayStart)
                        .limit(1)
                        .maybeSingle();

                    if (!openSession) {
                        console.log(`[API] DUPLICATE Time Out blocked (Legacy): Student=${studentCheck.id}, Class=${classIdInput}`);
                        return NextResponse.json({
                            error: "Already Timed Out / No Time In",
                            student_name: student_name,
                            duplicate: true
                        }, { status: 409 });
                    }
                }
            }
        }

        // Call the RPC function (Original working method)
        const { data: rpcData, error: rpcError } = await supabase.rpc('log_attendance', {
            email_input: email,
            student_name_input: student_name || '',
            class_name_input: className || '',
            status_input: rpcStatusInput,
            timestamp_input: timestamp,
            instructor_id_input: instructorIdInput,
            class_id_input: classIdInput
        });

        if (rpcError) {
            console.error("RPC Transport Error:", rpcError);
            return NextResponse.json({ error: rpcError.message }, { status: 500 });
        }

        // Check for Application-Level Error from RPC (e.g., "Student not found")
        // The RPC returns { error: "..." } or { success: true }
        const resultData = rpcData as { error?: string; success?: boolean };

        if (resultData && resultData.error) {
            console.warn("RPC Failed (APP Error):", resultData.error);
            console.log("Attempting Manual Fallback...");

            // 1. Find the Class (using ID or Name+Instructor)
            interface ClassWithInstructor {
                id: string;
                name: string;
                instructor_id: string;
                start_time: string | null;
                end_time: string | null;
                instructors: { owner_id: string } | { owner_id: string }[] | null;
            }

            let classRef: ClassWithInstructor | null = null;
            if (classIdInput) {
                const { data: c } = await supabase
                    .from('classes')
                    .select('id, instructor_id, start_time, end_time, instructors!classes_instructor_id_fkey(user_id)')
                    .eq('id', classIdInput)
                    .single();
                classRef = c as unknown as ClassWithInstructor;
            }

            if (!classRef && instructorIdInput) {
                const { data: c } = await supabase
                    .from('classes')
                    .select('id, instructor_id, start_time, end_time, instructors!classes_instructor_id_fkey(user_id)')
                    .eq('name', className)
                    .eq('instructor_id', instructorIdInput)
                    .limit(1)
                    .maybeSingle();
                classRef = c as unknown as ClassWithInstructor;
            }

            if (!classRef) {
                return NextResponse.json({ error: "Class not found (Fallback)" }, { status: 400 });
            }

            // 2. Find the Student (using Name + Instructor)
            // Students are linked to the INSTRUCTOR, not necessarily the Kiosk User
            const targetInstructorId = classRef.instructor_id;

            let { data: student } = await supabase.from('students')
                .select('id')
                .or(`name.eq."${student_name}",full_name.eq."${student_name}"`)
                .eq('instructor_id', targetInstructorId)
                .limit(1)
                .maybeSingle();

            if (!student) {
                // If .or() fails due to missing column, try simple name
                const { data: fallbackStudent } = await supabase.from('students')
                    .select('id')
                    .eq('name', student_name)
                    .eq('instructor_id', targetInstructorId)
                    .limit(1)
                    .maybeSingle();

                if (!fallbackStudent) {
                    return NextResponse.json({ error: `Student '${student_name}' not found for this instructor.` }, { status: 400 });
                }
                student = fallbackStudent;
            }

            // GRADING LOGIC HELPER
            const getMinutes = (timeStr: string | null | undefined) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':').map(Number);
                if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
                return parts[0] * 60 + parts[1];
            };

            const nowManila = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
            const currentMinutes = getMinutes(nowManila);

            console.log(`[API] Fallback Grading: Now=${nowManila} (${currentMinutes}m)`);

            let calculatedStatus = 'Present';

            // 3. Handle Time In vs Time Out
            if (attendance_type === "Time Out") {
                // Try to find an efficient open session for this student + class + today
                const todayStart = new Date().toISOString().split('T')[0]; // YYYY-MM-DD checks

                const { data: openSession, error: sessionError } = await supabase.from('attendance_logs')
                    .select('id, status, timestamp')
                    .eq('student_id', student.id)
                    .eq('class_id', classRef.id)
                    .is('time_out', null)
                    .gte('timestamp', todayStart) // Optimization: use index if available
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (sessionError) {
                    console.error("[API] Session Lookup Error:", sessionError);
                    throw sessionError;
                }

                if (openSession) {
                    calculatedStatus = openSession.status; // Default to existing
                    console.log(`[API] Found Open Session: ${openSession.id} (Status: ${calculatedStatus})`);

                    if (openSession.status !== 'Absent' && classRef.end_time) {
                        const endMinutes = getMinutes(classRef.end_time);

                        // Check Early Departure (> 15 mins before end)
                        if ((endMinutes - currentMinutes) > 15) {
                            calculatedStatus = 'Absent'; // Cutting Class
                            console.log(`[API] Early Departure: End=${classRef.end_time} (${endMinutes}m), Current=${currentMinutes}m -> Absent`);
                        }
                        // Check Ghosting (> 60 mins after end)
                        else if ((currentMinutes - endMinutes) > 60) {
                            calculatedStatus = 'Absent'; // Ghosting
                            console.log(`[API] Ghosting: End=${classRef.end_time} (${endMinutes}m), Current=${currentMinutes}m -> Absent`);
                        }
                    }

                    // UPDATE existing session
                    const { error: updateError } = await supabase.from('attendance_logs')
                        .update({
                            time_out: timestamp,
                            status: calculatedStatus
                        })
                        .eq('id', openSession.id);

                    if (updateError) {
                        console.error("[API] Session Update Error:", updateError);
                        throw updateError;
                    }
                } else {
                    // SEQUENCE RULE: Reject Time Out if no Time In OR Already Timed Out
                    // We treat this as a duplicate scan so the UI handles it gracefully
                    console.warn(`[API] Time Out Denied/Duplicate: No open session found for Student=${student.id}, Class=${classRef.id}`);
                    return NextResponse.json(
                        {
                            error: "Already Timed Out / No Time In",
                            student_name: student_name,
                            duplicate: true
                        },
                        { status: 409 }
                    );
                }
            } else {
                // TIME IN
                // Duplicate prevention: check if already scanned today for this class
                const todayStart = new Date().toISOString().split('T')[0];
                const { data: existingLog } = await supabase
                    .from('attendance_logs')
                    .select('id')
                    .eq('student_id', student.id)
                    .eq('class_id', classRef.id)
                    .gte('timestamp', todayStart)
                    .maybeSingle();

                if (existingLog) {
                    console.log(`[API] Duplicate Time In blocked: Student=${student.id}, Class=${classRef.id}`);
                    return NextResponse.json({
                        error: "Already Scanned",
                        student_name: student_name,
                        duplicate: true
                    }, { status: 409 });
                }

                if (classRef.start_time) {
                    const startMinutes = getMinutes(classRef.start_time);
                    const delta = currentMinutes - startMinutes;

                    if (delta > 30) {
                        calculatedStatus = 'Absent';
                        console.log(`[API] Late (Absent): Start=${classRef.start_time} (${startMinutes}m), Delta=${delta}m -> Absent`);
                    } else if (delta > 15) {
                        calculatedStatus = 'Late';
                        console.log(`[API] Late: Start=${classRef.start_time} (${startMinutes}m), Delta=${delta}m -> Late`);
                    }
                }

                // Resolve the actual auth user ID (user_id) for attendance_logs
                // This fixes the FK constraint error (must be a valid auth.users.id)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const instructorData = (classRef as any).instructors;
                let targetOwnerId: string | null;

                if (Array.isArray(instructorData)) {
                    targetOwnerId = instructorData[0]?.user_id || null;
                } else {
                    targetOwnerId = instructorData?.user_id || null;
                }

                const { error: insertError } = await supabase.from('attendance_logs').insert({
                    student_id: student.id,
                    class_id: classRef.id,
                    user_id: targetOwnerId,
                    status: calculatedStatus,
                    timestamp: timestamp,
                    entry_method: entryMethod,
                });
                if (insertError) {
                    console.error("[API] Attendance Insert Error:", insertError);
                    throw insertError;
                }
            }

            // Send scan notification to instructor (fallback path)
            const fallbackClassName = classRef?.name || className || 'Unknown';
            await sendScanNotification(supabase, classRef.instructor_id, student_name || 'Unknown', fallbackClassName, calculatedStatus, attendance_type === 'Time Out' ? 'time_out' : 'time_in', entryMethod);

            return NextResponse.json({ success: true, message: "Attendance Logged (Fallback)" });
        }

        return NextResponse.json({ success: true, message: "Attendance Logged" });

    } catch (err) {
        console.error("API Error Log:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
