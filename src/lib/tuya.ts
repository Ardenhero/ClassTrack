import "server-only";
/**
 * Tuya IoT Service — Singleton client for controlling smart devices.
 * Uses the official @tuya/tuya-connector-nodejs SDK.
 * 
 * RECOMMENDATION: Set background sync workers to poll at 30-minute intervals (1800s).
 * Use statusCache (30m TTL) for standard GETs to significantly reduce API hits.
 */
import { TuyaContext } from '@tuya/tuya-connector-nodejs';

let _tuyaClient: TuyaContext | null = null;

// IN-MEMORY CACHE (Quota Preservation)
interface CacheEntry {
    data: unknown;
    timestamp: number;
}
const statusCache = new Map<string, CacheEntry>();
const INFO_CACHE_TTL = 1800 * 1000; // 30 minutes for device info 
const STATUS_CACHE_TTL = 1800 * 1000; // 30 minutes for status

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
 * Check if the current time is within Business Hours (7:00 AM - 7:00 PM PHT).
 * Philippine Time is UTC+8.
 */
export function isWithinBusinessHours(): boolean {
    const now = new Date();
    // UTC to PHT (+8)
    const pht = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const hours = pht.getUTCHours();
    return hours >= 7 && hours < 19;
}

// DP codes for locks
const LOCK_DP_CODES = ['unlock_ble', 'unlock_fingerprint', 'unlock_temporary', 'unlock_card'];

export async function controlDevice(deviceId: string, code: string, value: boolean | string | number): Promise<{ success: boolean; msg?: string }> {
    const tuya = getTuyaClient();

    // Invalidate status cache immediately after command
    statusCache.delete(`status:${deviceId}`);
    statusCache.delete(`info:${deviceId}`);




    const isLockCmd = LOCK_DP_CODES.includes(code);

    if (isLockCmd && value === true) {
        try {
            console.log(`[Tuya] Smart lock unlock for ${deviceId}, code=${code}`);
            const cmdResult = await tuya.request({
                method: 'POST',
                path: `/v1.0/iot-03/devices/${deviceId}/commands`,
                body: { commands: [{ code, value: true }] },
            });
            if (cmdResult.success) return { success: true };

            const ticketRes = await tuya.request({
                method: 'POST',
                path: `/v1.0/devices/${deviceId}/door-lock/password-ticket`,
                body: {},
            });

            if (ticketRes.success && ticketRes.result) {
                const ticketId = (ticketRes.result as { ticket_id: string }).ticket_id;
                const openRes = await tuya.request({
                    method: 'POST',
                    path: `/v1.0/devices/${deviceId}/door-lock/password-free/open-door`,
                    body: { ticket_id: ticketId, open: true },
                });
                if (openRes.success) return { success: true };
            }
            return { success: false, msg: 'Lock command failed' };
        } catch (err) {
            return { success: false, msg: String(err) };
        }
    }

    try {
        const result = await tuya.request({
            method: 'POST',
            path: `/v1.0/iot-03/devices/${deviceId}/commands`,
            body: { commands: [{ code, value }] },
        });

        if (result.success) return { success: true };
        return { success: false, msg: result.msg || 'Unknown Tuya error' };
    } catch (err) {
        return { success: false, msg: String(err) };
    }
}

/**
 * Get the current status/DPs with 30-minute caching.
 */
export async function getDeviceStatus(deviceId: string, force = false): Promise<{ success: boolean; data?: Record<string, unknown>[]; msg?: string; source?: 'cache' | 'tuya' }> {
    const cacheKey = `status:${deviceId}`;
    const cached = statusCache.get(cacheKey);

    if (!force && cached && (Date.now() - cached.timestamp < STATUS_CACHE_TTL)) {
        return { success: true, data: cached.data as Record<string, unknown>[], source: 'cache' };
    }

    try {
        const tuya = getTuyaClient();
        const result = await tuya.request({
            method: 'GET',
            path: `/v1.0/iot-03/devices/${deviceId}/status`,
        });

        if (result.success) {
            const data = result.result as Record<string, unknown>[];
            statusCache.set(cacheKey, { data, timestamp: Date.now() });
            return { success: true, data, source: 'tuya' };
        }
        return { success: false, msg: result.msg || 'Unknown error' };
    } catch (err) {
        return { success: false, msg: String(err) };
    }
}

/**
 * Get device info with 5-minute caching.
 */
export async function getDeviceInfo(deviceId: string, force = false): Promise<{ success: boolean; data?: Record<string, unknown>; msg?: string; source?: 'cache' | 'tuya' }> {
    const cacheKey = `info:${deviceId}`;
    const cached = statusCache.get(cacheKey);

    if (!force && cached && (Date.now() - cached.timestamp < INFO_CACHE_TTL)) {
        return { success: true, data: cached.data as Record<string, unknown>, source: 'cache' };
    }

    try {
        const tuya = getTuyaClient();
        const result = await tuya.request({
            method: 'GET',
            path: `/v1.0/devices/${deviceId}`,
        });

        if (result.success) {
            const data = result.result as Record<string, unknown>;
            statusCache.set(cacheKey, { data, timestamp: Date.now() });
            return { success: true, data, source: 'tuya' };
        }
        return { success: false, msg: result.msg || 'Unknown error' };
    } catch (err) {
        return { success: false, msg: String(err) };
    }
}
/**
 * Get all sub-devices linked to a Zigbee Gateway.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getGatewaySubDevices(gatewayId: string): Promise<{ success: boolean; data?: any[]; msg?: string }> {
    try {
        const tuya = getTuyaClient();
        const result = await tuya.request({
            method: 'GET',
            path: `/v1.0/devices/${gatewayId}/sub-devices`,
        });

        if (result.success) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { success: true, data: result.result as any[] };
        }
        return { success: false, msg: result.msg || 'Unknown error' };
    } catch (err) {
        return { success: false, msg: String(err) };
    }
}
