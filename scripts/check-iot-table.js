
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable() {
    const { data, error } = await supabase.from('room_settings').select('*').limit(1);
    if (error) {
        if (error.code === '42P01') {
            console.log('Table room_settings does NOT exist.');
        } else {
            console.log('Error checking table:', error);
        }
    } else {
        console.log('Table room_settings exists.');
    }
}

checkTable();
