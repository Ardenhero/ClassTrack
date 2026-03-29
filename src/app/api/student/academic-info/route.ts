import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";


interface Override {
    class_id: string;
    date: string;
    type: string;
    note: string | null;
    classes: { name: string } | null;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || searchParams.get('sin');

    try {
        // 1. Get ALL terms and find the one with is_active: true
        // This is more robust as it matches the logic used in the working Records page
        const { data: allTerms, error: termError } = await supabase
            .from('academic_terms')
            .select('*, academic_years(name)')
            .order('created_at', { ascending: false });

        if (termError) throw termError;

        const activeTerm = allTerms?.find(t => t.is_active) || null;
        const activeYear = (activeTerm as unknown as { academic_years: { name: string } | null })?.academic_years?.name || "N/A";

        let todayOverrides: Override[] = [];
        let debugInfo: Record<string, unknown> = {};
        if (studentId) {
            // Standardized Manila date calculation
            const today = new Intl.DateTimeFormat('fr-CA', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date());
            
            // Get student's enrolled classes
            const { data: enrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('class_id')
                .eq('student_id', studentId);
            
            const classIds = enrollments?.map(e => e.class_id) || [];
            
            debugInfo = {
                studentId,
                today,
                enrollmentCount: enrollments?.length || 0,
                enrollError: enrollError?.message || null,
                classIds: classIds.slice(0, 5) // first 5 for debug
            };
            
            if (classIds.length > 0) {
                const { data: overrides, error: overrideError } = await supabase
                    .from('class_day_overrides')
                    .select('class_id, date, type, note, classes(name)')
                    .in('class_id', classIds)
                    .eq('date', today);
                
                todayOverrides = (overrides as unknown as Override[]) || [];
                debugInfo.overrideCount = overrides?.length || 0;
                debugInfo.overrideError = overrideError?.message || null;
                debugInfo.rawOverrides = overrides;
            }
        }

        // Logic moved up to find activeTerm among allTerms

        return NextResponse.json({
            term: activeTerm,
            academic_year: activeYear || "N/A",
            overrides: todayOverrides,
            debug: debugInfo
        });

    } catch (err) {
        console.error("[AcademicInfo API] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
