import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getDeviceStatus } from "../../../../lib/tuya";

export const dynamic = 'force-dynamic';

/**
 * GET /api/iot/sync — Background worker to sync Tuya Cloud state to Supabase.
 * Call this every 30-60 minutes via Cron.
 */
export async function GET() {
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // Fetch all devices
        const { data: devices, error } = await adminClient
            .from('iot_devices')
            .select('id, dp_code, current_state');

        if (error) throw error;

        const results = await Promise.all(
            (devices || []).map(async (device) => {
                try {
                    const realDeviceId = (device.id as string).replace(/_ch\d+$/, '');
                    const status = await getDeviceStatus(realDeviceId);

                    if (status.success && status.data) {
                        const dpCode = device.dp_code || 'switch_1';
                        const dp = status.data.find((d: Record<string, unknown>) => d.code === dpCode) as Record<string, unknown> | undefined;

                        if (dp !== undefined) {
                            const actualState = Boolean(dp.value);
                            
                            // Update if different
                            if (actualState !== Boolean(device.current_state)) {
                                await adminClient
                                    .from('iot_devices')
                                    .update({ 
                                        current_state: actualState, 
                                        updated_at: new Date().toISOString() 
                                    })
                                    .eq('id', device.id);
                                return { id: device.id, synced: true, state: actualState };
                            }
                        }
                    }
                    return { id: device.id, synced: false };
                } catch (err) {
                    return { id: device.id, error: String(err) };
                }
            })
        );

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            results
        });

    } catch (err) {
        console.error("[IoT Sync] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
