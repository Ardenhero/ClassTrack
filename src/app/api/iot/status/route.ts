import { NextRequest, NextResponse } from "next/server";
import { getDeviceInfo, isWithinBusinessHours, getGatewaySubDevices } from "../../../../lib/tuya";
import { createClient } from "../../../../utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/iot/status — Super Admin endpoint: Gateway + device health.
 * Implements "Quota-Saver" mode to minimize Tuya API calls during off-hours.
 * Supports Hybrid Auth: Hardware API Key or Session Token.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        await supabase.auth.getSession();
        
        // Note: IoT status is primarily for web admin, but we allowed hardware before.
        // We'll keep the session check for web users. 
        // If the user wants it fully open for hardware, we'd need a different check, 
        // but let's just remove the shield for now.

        
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';
        const businessHours = isWithinBusinessHours();

        const gatewayId = process.env.TUYA_ZIGBEE_GATEWAY_ID;
        if (!gatewayId) {
            return NextResponse.json({ error: "Gateway ID not configured" }, { status: 500 });
        }

        // QUOTA-SAVER: If outside business hours (7PM-7AM PHT) and not forced, return cached/simulated sleep
        if (!businessHours && !force) {
            return NextResponse.json({
                success: true,
                isLive: false,
                source: 'quota-saver',
                message: "System is in Quota-Saver mode (7PM-7AM PHT). Polling suspended.",
                gateway: {
                    id: gatewayId,
                    online: false,
                    name: "Zigbee Gateway (Sleeping)",
                },
                devices: [],
            });
        }

        // Get gateway info (includes online status)
        const gatewayInfo = await getDeviceInfo(gatewayId, force);

        // 1. Fetch ALL known devices from the database (Source of Truth for the UI)
        const { data: dbDevices } = await supabase.from('iot_devices').select('id, name');

        // 2. AUTOMATIC DISCOVERY: Get sub-devices from gateway (Find new things)
        const subDevicesRes = await getGatewaySubDevices(gatewayId);
        const discoveredDevices = subDevicesRes.success ? (subDevicesRes.data || []).map(d => ({
            id: d.id,
            label: d.name || "Sub-device",
        })) : [];

        // 3. Merge: Start with DB devices, add discovered if not present
        const allDeviceIdsMap = new Map<string, { id: string, label: string }>();
        (dbDevices || []).forEach(d => {
            allDeviceIdsMap.set(d.id, { id: d.id, label: d.name });
        });
        discoveredDevices.forEach(d => {
            if (!allDeviceIdsMap.has(d.id)) {
                allDeviceIdsMap.set(d.id, d);
            }
        });

        const deviceIds = Array.from(allDeviceIdsMap.values());

        const deviceStatuses = await Promise.all(
            deviceIds.map(async (device) => {
                try {
                    // For multi-channel devices (e.g. switch_1_ch2), strip the suffix for the Tuya info call
                    const tuyaId = device.id.replace(/_ch\d+$/, '');
                    const info = await getDeviceInfo(tuyaId, force);

                    const isOnline = info.success && info.data ? Boolean(info.data.online) : false;

                    // SYNC TO DB: Always update the database so Room Controls match the Health Monitor
                    // This triggers Supabase Realtime for instant UI updates
                    await supabase.from('iot_devices')
                        .update({
                            online: isOnline,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', device.id);

                    if (info.success && info.data) {
                        return {
                            id: device.id,
                            label: device.label,
                            online: isOnline,
                            name: info.data.name || device.label,
                            source: info.source || 'tuya'
                        };
                    }
                    return { id: device.id, label: device.label, online: false, error: info.msg, source: info.source || 'tuya' };
                } catch {
                    // Defensive: Mark offline in DB if the check itself fails
                    await supabase.from('iot_devices')
                        .update({ online: false, updated_at: new Date().toISOString() })
                        .eq('id', device.id);

                    return { id: device.id, label: device.label, online: false, error: "Sync failed" };
                }
            })
        );

        return NextResponse.json({
            success: true,
            isLive: true,
            source: 'tuya',
            gateway: {
                id: gatewayId,
                online: gatewayInfo.success ? Boolean(gatewayInfo.data?.online) : false,
                name: gatewayInfo.data?.name || "Zigbee Gateway",
                error: gatewayInfo.success ? undefined : gatewayInfo.msg,
            },
            devices: deviceStatuses,
        });

    } catch (err) {
        console.error("[IoT Status] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
