const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking kiosk_devices...");
    const { data: devices, error: devErr } = await supabase.from('kiosk_devices').select('*');
    if (devErr) console.error(devErr);
    console.log(JSON.stringify(devices, null, 2));
}

check();
