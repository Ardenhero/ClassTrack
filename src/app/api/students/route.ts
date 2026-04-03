import { NextRequest, NextResponse } from "next/server";
import { getCachedStudents } from "@/lib/cache";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
    query: z.string().optional(),
    dept: z.string().uuid().or(z.string().regex(/^\d+$/)).optional(),
    year: z.string().uuid().or(z.string().regex(/^\d+$/)).optional(),
});

/**
 * GET /api/students — Client-side fetcher for SWR.
 * Wraps the existing server-side permission-gated logic.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const result = QuerySchema.safeParse(Object.fromEntries(searchParams));

        if (!result.success) {
            return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
        }

        // getCachedStudents handles instructor-scoping, role-filtering, 
        // and caching internally using Supabase Auth.
        const students = await getCachedStudents(
            result.data.query, 
            result.data.dept, 
            result.data.year
        );

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
