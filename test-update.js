const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data: rooms } = await supabase.from('rooms').select('id').limit(1);
    const roomId = rooms[0].id;
    console.log("Updating to room_id:", roomId);
    
    // 1. Update
    const { error: err1 } = await supabase.from('kiosk_devices').update({ room_id: roomId }).eq('device_serial', 'ESP32-LCD7-MAIN');
    console.log("Update error?", err1);
    
    // 2. Immediate read
    const { data: d1 } = await supabase.from('kiosk_devices').select('room_id').eq('device_serial', 'ESP32-LCD7-MAIN').single();
    console.log("Immediately after update:", d1);
}
test();
