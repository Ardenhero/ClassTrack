require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixStudent() {
    console.log("--- Student Data Before ---");
    const { data: students } = await supabase.from('students').select('*').ilike('name', '%arden hero damaso%');
    console.log(students);

    console.log("--- Links Data ---");
    const { data: links } = await supabase.from('fingerprint_device_links').select('*').ilike('device_id', '%');
    console.log(links);

    // Let's also check column schema of fingerprint_device_links by doing a dummy insert or select
    const { data: schemaTest, error } = await supabase.from('fingerprint_device_links').select('device_id').limit(1);
    if (error) {
        console.log("Error querying device_id:", error.message);
        const { error: err2 } = await supabase.from('fingerprint_device_links').select('device_serial').limit(1);
        console.log("Error querying device_serial:", err2?.message || "Success");
    } else {
        console.log("device_id column exists.");
    }
}
fixStudent();
