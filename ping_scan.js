require('dotenv').config({ path: '.env.local' });

async function mockScan() {
    const url = "https://classtrack-navy.vercel.app/api/attendance/log?email=ardenherodamaso@gmail.com";

    const payload = {
        fingerprint_slot_id: 4,
        device_id: "KIOSK-STC102",
        class_id: "",
        attendance_type: "Room Control",
        entry_method: "biometric",
        timestamp: new Date().toISOString()
    };

    console.log("Sending payload:", payload);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
}
mockScan();
