import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get("device_id");

        if (!deviceId) {
            return NextResponse.json(
                { error: "device_id query param required" },
                { status: 400 }
            );
        }

        // Get all occupied slots for this device
        const { data: occupiedSlots, error } = await supabase
            .from("fingerprint_slots")
            .select("slot_index")
            .eq("device_id", deviceId)
            .order("slot_index");

        if (error) {
            console.error("Fetch slots error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const occupiedSet = new Set((occupiedSlots || []).map(s => s.slot_index));

        // Find next available slot (1-127)
        let nextSlot = -1;
        for (let i = 1; i <= 127; i++) {
            if (!occupiedSet.has(i)) {
                nextSlot = i;
                break;
            }
        }

        if (nextSlot === -1) {
            return NextResponse.json(
                { error: "No available slots. All 127 slots are occupied." },
                { status: 409 }
            );
        }

        return NextResponse.json({
            slot_index: nextSlot,
            total_occupied: occupiedSet.size,
            total_capacity: 127,
        });

    } catch (err) {
        console.error("Next Slot API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
