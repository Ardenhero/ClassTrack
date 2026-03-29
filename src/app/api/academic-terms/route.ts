import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { data: terms, error } = await supabase
            .from('academic_terms')
            .select('*, academic_years(name)')
            .order('start_date', { ascending: false });

        if (error) throw error;

        return NextResponse.json(terms);
    } catch (error) {
        console.error('Academic Terms Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch academic terms' }, { status: 500 });
    }
}
