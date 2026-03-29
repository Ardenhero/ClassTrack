import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
        return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // ── Step 1: Resolve email to Department ID ──
    // We use listUsers() as a robust fallback for finding the target identity
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError || !authData.users) {
        return NextResponse.json({ error: "Failed to scan authorized users" }, { status: 500 });
    }

    const targetUser = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!targetUser) {
        return NextResponse.json({ error: "Authorized user not found" }, { status: 404 });
    }

    // Find the instructor/admin profile for this user to get their department
    const { data: profile, error: profileError } = await supabase
        .from('instructors')
        .select('department_id')
        .eq('auth_user_id', targetUser.id)
        .maybeSingle();

    if (profileError || !profile?.department_id) {
        return NextResponse.json({ error: "Department profile not found or unassigned" }, { status: 404 });
    }

    // ── Step 2: Query instructors for ONLY this department ──
    // We exclude admins/super-admins to only show true Instructors in the roller
    const { data: instructors, error: dbError } = await supabase
        .from('instructors')
        .select('id, name')
        .eq('department_id', profile.department_id)
        .in('role', ['instructor', 'admin'])
        .order('name', { ascending: true });

    if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(instructors || []);
}
