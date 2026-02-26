import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { TuyaContext } = await import('@tuya/tuya-connector-nodejs');

const tuya = new TuyaContext({
    baseUrl: process.env.TUYA_API_ENDPOINT || 'https://openapi.tuyacn.com',
    accessKey: process.env.TUYA_ACCESS_ID,
    secretKey: process.env.TUYA_ACCESS_SECRET,
});

async function run() {
    const deviceId = 'a30cc2b13a96f241feevlx'; // Use the Light ID from earlier
    console.log(`Sending switch_1 = true to ${deviceId}`);
    const res = await tuya.request({
        method: 'POST',
        path: `/v1.0/iot-03/devices/${deviceId}/commands`,
        body: { commands: [{ code: 'switch_1', value: true }] }
    });
    console.log("Tuya Response:", JSON.stringify(res, null, 2));
}

run();
