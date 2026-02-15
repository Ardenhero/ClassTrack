
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use Service Role to query DB freely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY not found. Using ANON key (might fail RLS).");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBiometricLog() {
    console.log("🔍  Finding a valid student for biometric test...");

    // 1. Find a student with a fingerprint ID
    const { data: students, error: sErr } = await supabase
        .from('students')
        .select('*')
        .not('fingerprint_slot_id', 'is', null)
        .limit(1);

    if (sErr || !students || students.length === 0) {
        console.error("❌  No student found with fingerprint_slot_id.", sErr?.message);
        return;
    }

    const student = students[0];
    console.log(`✅  Found Student: ${student.name} (ID: ${student.id}, Slot: ${student.fingerprint_slot_id})`);

    // 2. Find a class they are enrolled in
    const { data: enrollment, error: eErr } = await supabase
        .from('enrollments')
        .select('class_id, classes(name, instructor_id)')
        .eq('student_id', student.id)
        .limit(1)
        .maybeSingle();

    if (eErr || !enrollment) {
        console.error("❌  Student is not enrolled in any class.", eErr?.message);
        return;
    }

    const classId = enrollment.class_id;
    // @ts-ignore
    const className = enrollment.classes?.name || "Unknown Class";
    console.log(`✅  Found Enrolled Class: ${className} (ID: ${classId})`);

    // 3. Prepare Payload
    const payload = {
        fingerprint_slot_id: student.fingerprint_slot_id,
        device_id: "TEST-SCRIPT-PC",
        class_id: classId,
        attendance_type: "Time In",
        entry_method: "biometric"
    };

    console.log("\n📡  Sending Biometric Log Request...");
    console.log("    URL: http://localhost:3000/api/attendance/log?email=admin@engineering.edu");
    console.log("    Payload:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch('http://localhost:3000/api/attendance/log?email=admin@engineering.edu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const text = await response.text();

        console.log(`\n👉  Response Status: ${status}`);
        try {
            const json = JSON.parse(text);
            console.log("👉  Response Body:", JSON.stringify(json, null, 2));
        } catch {
            console.log("👉  Response Body (Text):", text);
        }

    } catch (err: any) {
        console.error("❌  Request Failed:", err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error("    (Is the local server running on port 3000?)");
        }
    }
}

testBiometricLog();
