require('dotenv').config({ path: '.env.local' });

async function checkSync() {
    const url = "https://classtrack-navy.vercel.app/api/kiosk/sync-templates?device_id=KIOSK-STC102";
    try {
        console.log("Fetching:", url);
        const res = await fetch(url);
        const text = await res.text();
        console.log("Sync Response:", text);
    } catch (err) {
        console.error(err);
    }
}
checkSync();
