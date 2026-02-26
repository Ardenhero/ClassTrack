require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStudent() {
    console.log("--- Student Data ---");
    const { data: students } = await supabase.from('students').select('*').ilike('name', '%arden hero damaso%');
    console.log(students);

    console.log("\n--- Instructor Data ---");
    const { data: instructors } = await supabase.from('instructors').select('*').ilike('name', '%arden hero damaso%');
    console.log(instructors);

    console.log("\n--- Fingerprint Slots Data ---");
    const { data: slots } = await supabase.from('fingerprint_slots').select('*');
    console.log(slots);
}
checkStudent();
