import { NextResponse } from "next/server";
import { getDeviceInfo } from "@/lib/tuya";

export const dynamic = 'force-dynamic';

/**
 * GET /api/iot/status — Super Admin endpoint: Gateway + device health.
 */
export async function GET() {
    try {
        const gatewayId = process.env.TUYA_ZIGBEE_GATEWAY_ID;

        if (!gatewayId) {
            return NextResponse.json(
                { error: "Gateway ID not configured" },
                { status: 500 }
            );
        }

        // Get gateway info (includes online status)
        const gatewayInfo = await getDeviceInfo(gatewayId);

        // Collect all configured device IDs
        const deviceIds = [
            { id: process.env.TUYA_SWITCH_1_ID, label: "Smart Switch 1" },
            { id: process.env.TUYA_SWITCH_2_ID, label: "Smart Switch 2" },
            { id: process.env.TUYA_PLUG_1_ID, label: "Smart Plug 1" },
            { id: process.env.TUYA_PLUG_2_ID, label: "Smart Plug 2" },
        ].filter(d => d.id && !d.id.includes('_here')); // Skip placeholders

        const deviceStatuses = await Promise.all(
            deviceIds.map(async (device) => {
                try {
                    const info = await getDeviceInfo(device.id!);
                    if (info.success && info.data) {
                        return {
                            id: device.id,
                            label: device.label,
                            online: Boolean(info.data.online),
                            name: info.data.name || device.label,
                        };
                    }
                    return { id: device.id, label: device.label, online: false, error: info.msg };
                } catch {
                    return { id: device.id, label: device.label, online: false, error: "Request failed" };
                }
            })
        );

        return NextResponse.json({
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
