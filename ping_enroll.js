require('dotenv').config({ path: '.env.local' });

async function testEnroll() {
    // Jaylord Bartolome
    const payload = {
        student_id: 137,
        device_id: "KIOSK-STC102",
        slot_index: 5
    };

    const res = await fetch("https://classtrack-navy.vercel.app/api/fingerprint/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    try {
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Response:", data);
    } catch (e) {
        console.error(e);
        console.log(await res.text());
    }
}

testEnroll();
