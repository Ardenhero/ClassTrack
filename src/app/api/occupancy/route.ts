import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/occupancy — Increment or decrement room occupancy counter.
 * Body: { room_id: string, action: 'increment' | 'decrement' }
 * Called internally by the attendance log route.
 */
export async function PATCH(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { room_id, action } = await request.json();

        if (!room_id || !['increment', 'decrement'].includes(action)) {
            return NextResponse.json(
                { error: "room_id and action ('increment'|'decrement') required" },
                { status: 400 }
            );
        }

        // Ensure room_occupancy row exists (upsert with default 0)
        await supabase
            .from('room_occupancy')
            .upsert(
                { room_id, current_count: 0, last_updated: new Date().toISOString() },
                { onConflict: 'room_id', ignoreDuplicates: true }
            );

        // Atomically increment or decrement using RPC
        const delta = action === 'increment' ? 1 : -1;
        const { error } = await supabase.rpc('update_room_occupancy', {
            p_room_id: room_id,
            p_delta: delta,
        });

        if (error) {
            // Fallback: direct update if RPC doesn't exist yet
            console.warn("[Occupancy] RPC fallback:", error.message);
            const { data: current } = await supabase
                .from('room_occupancy')
                .select('current_count')
                .eq('room_id', room_id)
                .single();

            const newCount = Math.max(0, (current?.current_count || 0) + delta);
            await supabase
                .from('room_occupancy')
                .update({ current_count: newCount, last_updated: new Date().toISOString() })
                .eq('room_id', room_id);
        }

        return NextResponse.json({ success: true, room_id, action });

    } catch (err) {
        console.error("[Occupancy] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/occupancy?room_id=<uuid>
 * Returns current room occupancy. If no room_id, returns all rooms.
 */
export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get("room_id");

        let query = supabase
            .from('room_occupancy')
            .select('*, rooms(name, building)');

        if (roomId) {
            query = query.eq('room_id', roomId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ occupancy: data || [] });

    } catch (err) {
        console.error("[Occupancy GET] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
