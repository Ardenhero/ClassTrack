import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fetch from 'node-fetch';

async function test() {
   // Simulated Room Activation payload as if ESP32 sent it
   const res = await fetch('http://localhost:3000/api/attendance/log', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           device_id: 'ESP32-LCD7-MAIN',
           class_id: '',
           attendance_type: 'Room Control',
           entry_method: 'biometric',
           fingerprint_slot_id: 200, // Assuming 200 is testing Activator Slot
           timestamp: new Date().toISOString()
       })
   });
   
   console.log("Local API test:", await res.json());
}
test();
