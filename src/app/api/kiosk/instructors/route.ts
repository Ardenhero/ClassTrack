import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/kiosk/instructors
 * 
 * Lists instructors in the same department as the requester.
 * Supports both Session Auth (web) and Instructor Email (ESP32).
 */
export async function GET(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let targetUserId: string | null = null;
    let departmentId: string | null = null;

    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
        // Fallback to session/token auth for web portal
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];


        if (!token) {
            return NextResponse.json({ error: "Unauthorized: Missing API Key or Token" }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }
        targetUserId = user.id;
    } else {
        // If it's a valid hardware request, resolve identity via email
        const email = req.nextUrl.searchParams.get("email");
        if (!email) {
            return NextResponse.json({ error: "Missing identity (email)" }, { status: 400 });
        }
        
        const { data: profile } = await supabase
            .from('instructors')
            .select('auth_user_id, department_id')
            .eq('email', email)
            .maybeSingle();
            
        if (!profile) {
            return NextResponse.json({ error: "Identity not found" }, { status: 404 });
        }
        targetUserId = profile.auth_user_id;
        departmentId = profile.department_id;
    }

    // Find the instructor/admin profile for this user to get their department (if not already found)
    if (!departmentId && targetUserId) {
        const { data: profile, error: profileError } = await supabase
            .from('instructors')
            .select('department_id')
            .eq('auth_user_id', targetUserId)
            .maybeSingle();

        if (profileError || !profile?.department_id) {
            return NextResponse.json({ error: "Department profile not found or unassigned" }, { status: 404 });
        }
        departmentId = profile.department_id;
    }

    if (!departmentId) {
        return NextResponse.json({ error: "Department not identified" }, { status: 400 });
    }

    // ── Step 2: Query instructors for ONLY this department ──
    const { data: instructors, error: dbError } = await supabase
        .from('instructors')
        .select('id, name')
        .eq('department_id', departmentId)
        .in('role', ['instructor', 'admin'])
        .order('name', { ascending: true });

    if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(instructors || []);
}
