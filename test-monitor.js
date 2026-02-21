const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function monitor() {
    console.log("Monitoring all kiosk_devices...");
    let lastStates = {};
    
    while(true) {
        const { data } = await supabase.from('kiosk_devices').select('device_serial, room_id, status, is_online, pending_command, updated_at');
        if (data) {
            data.forEach(d => {
                if (!lastStates[d.device_serial]) {
                    lastStates[d.device_serial] = d.room_id;
                } else if (lastStates[d.device_serial] !== d.room_id) {
                    console.log(`[${new Date().toISOString()}] ${d.device_serial} room_id changed: ${lastStates[d.device_serial]} -> ${d.room_id}`);
                    lastStates[d.device_serial] = d.room_id;
                }
            });
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}
monitor();
