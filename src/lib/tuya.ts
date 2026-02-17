/**
 * Tuya IoT Service — Singleton client for controlling smart devices.
 * Uses the official @tuya/tuya-connector-nodejs SDK.
 */
import { TuyaContext } from '@tuya/tuya-connector-nodejs';

let _tuyaClient: TuyaContext | null = null;

function getTuyaClient(): TuyaContext {
    if (!_tuyaClient) {
        const accessKey = process.env.TUYA_ACCESS_ID;
        const secretKey = process.env.TUYA_ACCESS_SECRET;
        const baseUrl = process.env.TUYA_API_ENDPOINT || 'https://openapi.tuyacn.com';

        if (!accessKey || !secretKey) {
            throw new Error('TUYA_ACCESS_ID and TUYA_ACCESS_SECRET must be set in environment variables.');
        }

        _tuyaClient = new TuyaContext({
            baseUrl,
            accessKey,
            secretKey,
        });
    }
    return _tuyaClient;
}

/**
 * Send a command to a Tuya device.
 * @param deviceId  Tuya device ID
 * @param code      Data point code (e.g. "switch_1", "switch")
 * @param value     Boolean true=ON, false=OFF
 */
export async function controlDevice(deviceId: string, code: string, value: boolean): Promise<{ success: boolean; msg?: string }> {
    try {
        const tuya = getTuyaClient();
        const result = await tuya.request({
            method: 'POST',
            path: `/v1.0/iot-03/devices/${deviceId}/commands`,
            body: {
                commands: [{ code, value }],
            },
        });

        if (result.success) {
            return { success: true };
        } else {
            console.error('[Tuya] Command failed:', result);
            return { success: false, msg: result.msg || 'Unknown Tuya error' };
        }
    } catch (err) {
        console.error('[Tuya] Request error:', err);
        return { success: false, msg: String(err) };
    }
}

/**
 * Get the current status/DPs of a Tuya device.
 */
export async function getDeviceStatus(deviceId: string): Promise<{ success: boolean; data?: Record<string, unknown>[]; msg?: string }> {
    try {
        const tuya = getTuyaClient();
        const result = await tuya.request({
            method: 'GET',
            path: `/v1.0/iot-03/devices/${deviceId}/status`,
        });

        if (result.success) {
            return { success: true, data: result.result as Record<string, unknown>[] };
        } else {
            return { success: false, msg: result.msg || 'Unknown error' };
        }
    } catch (err) {
        console.error('[Tuya] Status error:', err);
        return { success: false, msg: String(err) };
    }
}

/**
 * Get device info (includes online status).
 */
export async function getDeviceInfo(deviceId: string): Promise<{ success: boolean; data?: Record<string, unknown>; msg?: string }> {
    try {
        const tuya = getTuyaClient();
        const result = await tuya.request({
            method: 'GET',
            path: `/v1.0/devices/${deviceId}`,
        });

        if (result.success) {
            return { success: true, data: result.result as Record<string, unknown> };
        } else {
            return { success: false, msg: result.msg || 'Unknown error' };
        }
    } catch (err) {
        console.error('[Tuya] Info error:', err);
        return { success: false, msg: String(err) };
    }
}
