import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    // Use Service Role to bypass RLS for this system endpoint
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { data: students, error } = await supabase
            .from("students")
            .select("fingerprint_slot_id, name")
            .not("fingerprint_slot_id", "is", null);

        if (error) throw error;

        // Extract IDs and names, verify valid IDs
        const slots = students
            .filter(s => s.fingerprint_slot_id && s.fingerprint_slot_id > 0)
            .map(s => ({
                id: s.fingerprint_slot_id,
                name: s.name
            }))
            .sort((a, b) => a.id - b.id);

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
