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

// DP codes that are lock-specific and may need special API handling
const LOCK_DP_CODES = ['unlock_ble', 'unlock_fingerprint', 'unlock_temporary', 'unlock_card'];

/**
 * Send a command to a Tuya device.
 * For BLE smart locks, tries the lock-specific API first, then standard commands.
 * @param deviceId  Tuya device ID
 * @param code      Data point code (e.g. "switch_1", "switch", "unlock_ble")
 * @param value     Boolean true=ON, false=OFF, or string/number for special dp_codes
 */
export async function controlDevice(deviceId: string, code: string, value: boolean | string | number): Promise<{ success: boolean; msg?: string }> {
    const tuya = getTuyaClient();
    const isLockCmd = LOCK_DP_CODES.includes(code);

    // For lock commands, use Tuya's Smart Lock API
    if (isLockCmd && value === true) {
        try {
            console.log(`[Tuya] Smart lock unlock for ${deviceId}, code=${code}`);

            // Method 1: Password ticket flow (most common)
            // Step 1: Get ticket from /v1.0/devices/{id}/door-lock/password-ticket
            const ticketRes = await tuya.request({
                method: 'POST',
                path: `/v1.0/devices/${deviceId}/door-lock/password-ticket`,
                body: {},
            });

            if (ticketRes.success && ticketRes.result) {
                const ticketId = (ticketRes.result as { ticket_id: string }).ticket_id;
                console.log(`[Tuya] Got ticket: ${ticketId}`);

                // Step 2: Open door with ticket
                const openRes = await tuya.request({
                    method: 'POST',
                    path: `/v1.0/devices/${deviceId}/door-lock/password-free/open-door`,
                    body: { ticket_id: ticketId },
                });

                if (openRes.success) {
                    console.log('[Tuya] Lock unlocked via password-ticket flow!');
                    return { success: true };
                }
                console.warn('[Tuya] open-door failed:', openRes.code, openRes.msg);
            } else {
                console.warn('[Tuya] password-ticket failed:', ticketRes.code, ticketRes.msg);
            }

            // Method 2: door-operate (alternate path for some lock models)
            const operateRes = await tuya.request({
                method: 'POST',
                path: `/v1.0/smart-lock/devices/${deviceId}/password-free/door-operate`,
                body: { action: true },
            });
            if (operateRes.success) {
                console.log('[Tuya] Lock unlocked via door-operate!');
                return { success: true };
            }
            console.warn('[Tuya] door-operate failed:', operateRes.code, operateRes.msg);

            // Method 3: Standard commands fallback (some Wi-Fi locks)
            const cmdResult = await tuya.request({
                method: 'POST',
                path: `/v1.0/iot-03/devices/${deviceId}/commands`,
                body: { commands: [{ code, value: true }] },
            });
            if (cmdResult.success) {
                console.log('[Tuya] Lock unlocked via standard commands!');
                return { success: true };
            }

            console.error('[Tuya] ALL lock methods failed. This lock may not support cloud unlock.');
            return { success: false, msg: 'Lock does not support remote cloud unlock. Try using the Tuya app via Bluetooth.' };
        } catch (err) {
            console.error('[Tuya] Lock request error:', err);
            return { success: false, msg: `Lock error: ${String(err)}` };
        }
    }

    // Standard command for non-lock devices
    try {
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
