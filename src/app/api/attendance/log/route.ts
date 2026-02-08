import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const LogSchema = z.object({
    student_name: z.string(),
    class: z.string(),
    year_level: z.union([z.string(), z.number()]),
    attendance_type: z.string(),
    timestamp: z.string(),
    class_id: z.string().optional(),
    instructor_id: z.string().optional(),
});

// Use Service Role Key to bypass RLS and Auth requirements for this trusted endpoint
export async function POST(request: Request) {


    // Config: Prefer Service Key for RLS bypass, fallback to Anon Key if missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("[API] Service Role Key missing, falling back to Anon Key.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

        const { student_name, class: className, instructor_id, attendance_type } = result.data;

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
        const instructorIdInput = sanitizeUuid(instructor_id);

        console.log(`[API] Log Attendance: ${student_name} -> ${className} (${classIdInput || 'No ID'}) [${rpcStatusInput}]`);

        // Call the RPC function (Original working method)
        const { data: rpcData, error: rpcError } = await supabase.rpc('log_attendance', {
            email_input: email,
            student_name_input: student_name,
            class_name_input: className,
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

            // FALLBACK: Manual Insert
            // 1. Find the Class (using ID or Name+Instructor)
            let classRef = null;
            if (classIdInput) {
                const { data: c } = await supabase.from('classes').select('id, instructor_id, start_time, end_time').eq('id', classIdInput).single();
                classRef = c;
            }

            if (!classRef && instructorIdInput) {
                const { data: c } = await supabase.from('classes').select('id, instructor_id, start_time, end_time').eq('name', className).eq('instructor_id', instructorIdInput).limit(1).maybeSingle();
                classRef = c;
            }

            if (!classRef) {
                return NextResponse.json({ error: "Class not found (Fallback)" }, { status: 404 });
            }

            // 2. Find the Student (using Name + Instructor)
            // Students are linked to the INSTRUCTOR, not necessarily the Kiosk User
            const targetInstructorId = classRef.instructor_id;

            let { data: student } = await supabase.from('students')
                .select('id')
                .eq('name', student_name) // check column name (name or full_name?)
                .eq('instructor_id', targetInstructorId)
                .limit(1)
                .maybeSingle();

            if (!student) {
                // Try 'full_name' just in case schema differs
                const { data: student2 } = await supabase.from('students')
                    .select('id')
                    .eq('full_name', student_name)
                    .eq('instructor_id', targetInstructorId)
                    .limit(1)
                    .maybeSingle();

                if (!student2) {
                    return NextResponse.json({ error: `Student '${student_name}' not found for this instructor.` }, { status: 404 });
                }
                // Found via full_name
                student = student2;
            }

            // GRADING LOGIC HELPER
            const getMinutes = (timeStr: string) => {
                const [h, m] = timeStr.split(':').map(Number);
                return h * 60 + m;
            };

            const nowManila = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
            const currentMinutes = getMinutes(nowManila);

            let calculatedStatus = 'Present';

            // 3. Handle Time In vs Time Out
            if (attendance_type === "Time Out") {
                // Try to find an efficient open session for this student + class + today
                const todayStart = new Date().toISOString().split('T')[0]; // YYYY-MM-DD checks

                const { data: openSession } = await supabase.from('attendance_logs')
                    .select('id, status, timestamp')
                    .eq('student_id', student.id)
                    .eq('class_id', classRef.id)
                    .is('time_out', null)
                    .gte('timestamp', todayStart) // Optimization: use index if available
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (openSession) {
                    calculatedStatus = openSession.status; // Default to existing

                    // PERSISTENCE RULE: If already Absent, stay Absent
                    // Also: Detect if initial session was INVALID (Too Early)
                    // If invalid, we probably shouldn't even be here effectively, or we let them close it but status remains invalid.
                    // But for now, let's stick to standard strict grading.

                    if (openSession.status !== 'Absent' && classRef.end_time) {
                        const endMinutes = getMinutes(classRef.end_time);

                        // Check Early Departure (> 15 mins before end)
                        // Handle date rollover if needed? Assuming same day classes for now.
                        if ((endMinutes - currentMinutes) > 15) {
                            calculatedStatus = 'Absent'; // Cutting Class
                        }
                        // Check Ghosting (> 60 mins after end)
                        else if ((currentMinutes - endMinutes) > 60) {
                            calculatedStatus = 'Absent'; // Ghosting
                        }
                    }

                    // UPDATE existing session
                    const { error: updateError } = await supabase.from('attendance_logs')
                        .update({
                            time_out: timestamp,
                            status: calculatedStatus
                        })
                        .eq('id', openSession.id);

                    if (updateError) throw updateError;
                } else {
                    // STRICT SEQUENCE RULE: Reject Time Out if no Time In
                    return NextResponse.json(
                        { error: "Access Denied: You must Time In first." },
                        { status: 400 }
                    );
                }
            } else {
                // TIME IN
                if (classRef.start_time) {
                    const startMinutes = getMinutes(classRef.start_time);
                    const delta = currentMinutes - startMinutes;

                    if (delta > 30) {
                        calculatedStatus = 'Absent';
                    } else if (delta > 15) {
                        calculatedStatus = 'Late';
                    }
                }

                const { error: insertError } = await supabase.from('attendance_logs').insert({
                    student_id: student.id,
                    class_id: classRef.id,
                    user_id: targetInstructorId, // Important: Link to Instructor
                    status: calculatedStatus,
                    timestamp: timestamp,
                    // time_out is null
                });
                if (insertError) throw insertError;
            }

            return NextResponse.json({ success: true, message: "Attendance Logged (Fallback)" });
        }

        return NextResponse.json({ success: true, message: "Attendance Logged" });

    } catch (err) {
        console.error("API Error Log:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
