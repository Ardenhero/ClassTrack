const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Binding kiosk to a room...");
    
    // get a valid room id
    const { data: rooms } = await supabase.from('rooms').select('id').limit(1);
    const roomId = rooms[0].id;
    const deviceSerial = 'ESP32-LCD7-MAIN';
    
    // Update
    await supabase.from('kiosk_devices').update({ room_id: roomId }).eq('device_serial', deviceSerial);
    console.log(`Bound ${deviceSerial} to ${roomId}`);
    
    let lastRoomId = roomId;
    for(let i=0; i<60; i++) {
        const { data } = await supabase.from('kiosk_devices').select('room_id').eq('device_serial', deviceSerial).single();
        if (data.room_id !== lastRoomId) {
            console.log(`[${new Date().toISOString()}] REVERTED: ${lastRoomId} -> ${data.room_id}`);
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Done monitoring.");
}
run();
