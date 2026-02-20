import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/kiosk/sync-templates?device_id=ESP32-LCD7-MAIN
 * Returns all fingerprint_slots for a device with student names.
 * Used by ESP32 on boot to reconcile local sensor memory.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const device_id = searchParams.get("device_id");

        if (!device_id) {
            return NextResponse.json(
                { error: "device_id query parameter is required" },
                { status: 400 }
            );
        }

        // Fetch all slots for this device with student info
        const { data: slots, error } = await supabase
            .from('fingerprint_slots')
            .select('slot_index, student_id, students(name)')
            .eq('device_id', device_id)
            .order('slot_index', { ascending: true });

        if (error) {
            console.error("[SyncTemplates] Query error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Flatten the response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (slots || []).map((slot: any) => ({
            slot_index: slot.slot_index as number,
            student_id: slot.student_id as number | null,
            student_name: slot.students?.name || "Unknown",
        }));

        return NextResponse.json({
            device_id,
            slot_count: result.length,
            slots: result,
        });

    } catch (err) {
        console.error("[SyncTemplates] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
