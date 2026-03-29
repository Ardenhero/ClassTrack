const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking for 'Arden Hero Damaso' and SIN '22-01726'...");

    const { data: students, error: sErr } = await supabase
        .from('students')
        .select('id, name, sin, instructor_id')
        .or('name.ilike.%Arden Hero Damaso%,sin.eq.22-01726');

    if (sErr) {
        console.error("Error fetching students:", sErr);
        return;
    }

    console.log("Found students:", JSON.stringify(students, null, 2));

    if (students.length > 0) {
        const studentIds = students.map(s => s.id);
        console.log(`Checking attendance_logs for IDs: ${studentIds.join(', ')}`);

        const { data: logs, error: lErr } = await supabase
            .from('attendance_logs')
            .select('id, student_id, timestamp, status, class_id')
            .in('student_id', studentIds);

        if (lErr) {
            console.error("Error fetching logs:", lErr);
        } else {
            console.log(`Found ${logs.length} logs for these students.`);
            const logCounts = {};
            logs.forEach(l => {
                logCounts[l.student_id] = (logCounts[l.student_id] || 0) + 1;
            });
            console.log("Logs per student ID:", logCounts);
        }

        // Check if there are logs with student_id that doesn't exist in students table (if possible)
        // Actually, check if there are logs with student_id that is NOT in our found list but related?
        // Hard to do without a full scan.
    } else {
        console.log("No students found matching the name/SIN.");
    }
}

check();
