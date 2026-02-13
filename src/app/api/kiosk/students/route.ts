import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request) {
    const supabase = createClient();

    try {
        // const { searchParams } = new URL(request.url);
        // The RPC returns unenrolled students directly
        const { data: students, error } = await supabase.rpc('get_unenrolled_students');

        if (error) {
            console.error("Fetch students RPC error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(students || []);

    } catch (err) {
        console.error("Kiosk Students API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
