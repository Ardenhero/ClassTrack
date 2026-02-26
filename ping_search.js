require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function search() {
    const { data: students } = await supabase.from('students').select('id, name, fingerprint_slot_id').not('fingerprint_slot_id', 'is', null);
    console.log("Occupied Student Slots:", students);
}
search();
