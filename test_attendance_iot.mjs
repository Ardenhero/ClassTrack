import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    // 1. Manually reset DB state to False (OFF) for all devices in STC 102
    await supabase.from('iot_devices').update({ current_state: false }).eq('room_id', 'e76032d9-7390-43a4-8386-b88cad562d16');
    
    // 2. Trigger the Room Activation log
    console.log("Triggering Room Activation scan (should turn ON)...");
    const res = await fetch('http://localhost:3000/api/attendance/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'valid-kiosk-key-if-needed'
        },
        body: JSON.stringify({
            device_id: 'ESP32-LCD7-MAIN',
            fingerprint_slot_id: 250, // Test Activator Slot
            attendance_type: 'Room Control',
            entry_method: 'biometric',
            timestamp: new Date().toISOString()
        })
    });
    
    console.log("Response Status:", res.status);
    const json = await res.json();
    console.log("Response Body:", JSON.stringify(json, null, 2));
}

run();
