require('dotenv').config({ path: '.env.local' });

async function testApi() {
    const url = "https://classtrack-navy.vercel.app/api/attendance/log?email=" + process.env.USER_EMAIL;
    const payload = {
        fingerprint_slot_id: 4,
        device_id: "KIOSK-STC102",
        class_id: "",
        attendance_type: "Room Control",
        entry_method: "biometric",
        timestamp: new Date().toISOString()
    };

    console.log("Sending payload to Production:", payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const text = await response.text();
        console.log(`\nHTTP ${status}`);

        try {
            console.log("JSON Response:", JSON.parse(text));
        } catch (e) {
            console.log("Raw Response:", text);
        }
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

testApi();
