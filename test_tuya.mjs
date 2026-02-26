import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { TuyaContext } = await import('@tuya/tuya-connector-nodejs');

const tuya = new TuyaContext({
    baseUrl: process.env.TUYA_API_ENDPOINT || 'https://openapi.tuyacn.com',
    accessKey: process.env.TUYA_ACCESS_ID,
    secretKey: process.env.TUYA_ACCESS_SECRET,
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
    const { data: devices } = await supabase.from('iot_devices').select('*').limit(5);
    console.log("Found Devices:", devices);
    
    for (const d of devices) {
        const realId = d.id.replace(/_ch\d+$/, '');
        console.log(`Checking Tuya status for ${realId}...`);
        const result = await tuya.request({
            method: 'GET',
            path: `/v1.0/iot-03/devices/${realId}/status`,
        });
        console.log(`Result for ${d.name}:`, JSON.stringify(result, null, 2));
    }
}

test();
