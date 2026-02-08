import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createNotification } from '@/lib/notifications';

import { z } from 'zod';

const AttendanceSchema = z.object({
    fingerprint_id: z.number().int().positive()
});

export async function POST(request: Request) {
    const supabase = createClient();

    try {
        const body = await request.json();

        // Zod Validation
        const parseResult = AttendanceSchema.safeParse({ fingerprint_id: Number(body.fingerprint_id) });

        if (!parseResult.success) {
            return NextResponse.json({ error: 'Valid Fingerprint ID is required', details: parseResult.error.format() }, { status: 400 });
        }

        const { fingerprint_id } = parseResult.data;

        // Call the secure RPC function
        const { data, error } = await supabase.rpc('log_attendance_by_fingerprint', {
            p_fingerprint_id: Number(fingerprint_id)
        });

        if (error) {
            console.error('RPC Error:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }

        if (data?.error) {
            console.error('Student lookup error:', data.error);
            return NextResponse.json({ error: data.error }, { status: 404 });
        }

        // Send notification (async, don't block response)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            createNotification(
                user.id,
                "Student Timed In",
                `${data.student_name} has marked attendance.`,
                "info"
            );
        }

        return NextResponse.json({
            message: 'Attendance logged successfully',
            student: data.student_name
        }, { status: 200 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
