import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getDeviceStatus } from './src/lib/tuya.js';

async function t() {
    console.log(await getDeviceStatus('a30cc2b13a96f241feevlx'));
}
t();
