import { NextRequest, NextResponse } from "next/server";
import { getCachedStudents } from "@/lib/cache";

export const dynamic = 'force-dynamic';

/**
 * GET /api/students — Client-side fetcher for SWR.
 * Wraps the existing server-side permission-gated logic.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query') || undefined;
        const dept = searchParams.get('dept') || undefined;
        const year = searchParams.get('year') || undefined;

        // getCachedStudents handles instructor-scoping, role-filtering, 
        // and caching internally using Supabase Auth.
        const students = await getCachedStudents(query, dept, year);

        return NextResponse.json({
            success: true,
            students,
            count: students.length,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error("[API Students] Error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: String(err) },
            { status: 500 }
        );
    }
}
