import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { data, error } = await supabase
            .from('academic_terms')
            .select('id, name, is_active')
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            console.error('[Term API] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch active term' }, { status: 500 });
        }

        return NextResponse.json({ data }, {
            status: 200,
            headers: {
                'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('[Term API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
