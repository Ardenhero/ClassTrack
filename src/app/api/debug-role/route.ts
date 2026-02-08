
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    if (!profileId) {
        return NextResponse.json({ error: "No profile cookie found" });
    }

    // 1. Check strict DB record
    const { data: dbRecord, error } = await supabase
        .from('instructors')
        .select('*')
        .eq('id', profileId)
        .single();

    return NextResponse.json({
        cookieProfileId: profileId,
        dbRecord: dbRecord,
        dbError: error,
        isAdminProfileCookie: profileId === 'admin-profile'
    });
}
