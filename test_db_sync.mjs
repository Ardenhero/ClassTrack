import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sync() {
    const { data: devices } = await supabase.from('iot_devices').select('*');
    console.log("Devices to flip OFF to true sync state:", devices.map(d => `${d.name} (${d.current_state})`));
    
    // Force set everything to OFF in the DB so next tap turns it ON
    for (const d of devices) {
        await supabase.from('iot_devices').update({ current_state: false }).eq('id', d.id);
    }
    console.log("Reset all devices to OFF in DB.");
}

sync();
