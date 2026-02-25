const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function test() {
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    let url = '';
    let key = '';
    envContent.split('\n').forEach(line => {
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
        if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
    });

    const supabase = createClient(url, key);

    // 1. Get a class and student
    const { data: classes } = await supabase.from('classes').select('*').limit(1);
    if (!classes || classes.length === 0) return;
    const testClass = classes[0];

    const { data: enrollments } = await supabase.from('enrollments').select('student_id').eq('class_id', testClass.id).limit(1);
    if (!enrollments || enrollments.length === 0) return;
    const studentId = enrollments[0].student_id;

    console.log("Testing insert with: student=", studentId, "class=", testClass.id, "instructor=", testClass.instructor_id);

    const { data, error } = await supabase.from('attendance_logs').insert({
        student_id: studentId,
        class_id: testClass.id,
        user_id: testClass.instructor_id,
        status: 'Present',
        timestamp: new Date().toISOString(),
        entry_method: 'biometric'
    });

    console.log("INSERT RESULT:", error ? error : "Success!");
}

test().catch(console.error);
