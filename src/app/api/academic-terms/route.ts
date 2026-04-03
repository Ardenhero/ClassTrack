import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
    academic_year_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const result = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
        return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        let query = supabase
            .from('academic_terms')
            .select('*, academic_years(name)')
            .order('start_date', { ascending: false });

        if (result.data.academic_year_id) {
            query = query.eq('academic_year_id', result.data.academic_year_id);
        }

        const { data: terms, error } = await query;

        if (error) throw error;

        return NextResponse.json(terms);
    } catch (error) {
        console.error('Academic Terms Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch academic terms' }, { status: 500 });
    }
}
