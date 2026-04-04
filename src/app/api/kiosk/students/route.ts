import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/kiosk/students?email=<instructor_email>
 * Returns all students in the same department as the identified instructor.
 * Supports: Instructor Email (Kiosk) or Session Token (Web).
 */
export async function GET(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let departmentId: string | null = null;
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
        // Session fallback
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];

        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

        const { data: prof } = await supabase.from('instructors').select('department_id').eq('auth_user_id', user.id).maybeSingle();
        departmentId = prof?.department_id || null;
    } else {
        // Hardware identity resolution
        const email = req.nextUrl.searchParams.get("email");
        if (!email) return NextResponse.json({ error: "Email parameter required" }, { status: 400 });

        const { data: profile } = await supabase
            .from('instructors')
            .select('department_id')
            .eq('email', email)
            .maybeSingle();
        
        departmentId = profile?.department_id || null;
    }

    if (!departmentId) {
        return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    try {
        const { data: students, error } = await supabase.rpc('get_unenrolled_students', { p_department_id: departmentId });

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
