import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient();

    try {
        const { data: students, error } = await supabase
            .from("students")
            .select("fingerprint_slot_id")
            .not("fingerprint_slot_id", "is", null);

        if (error) throw error;

        // Extract IDs and filter out any potential nulls/zeros just in case
        const slots = students
            .map(s => s.fingerprint_slot_id)
            .filter(id => id && id > 0)
            .sort((a, b) => a - b);

        return NextResponse.json({
            success: true,
            count: slots.length,
            slots
        });

    } catch (err: unknown) {
        console.error("Fetch Slots API Error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
