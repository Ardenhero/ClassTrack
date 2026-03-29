import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // Fetch all classes with their instructor's AUTH user ID
        const { data: classes, error: classError } = await supabase
            .from('classes')
            .select(`
                id, 
                name, 
                instructor_id,
                start_time,
                end_time,
                schedule_days,
                instructors!classes_instructor_id_fkey(auth_user_id)
            `);

        if (classError) throw classError;

        const results = [];
        const now = new Date();
        const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const currentDay = manilaTime.getDay();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = days[currentDay];
        const currentFullDayName = fullDays[currentDay];
        const todayStr = manilaTime.toISOString().split('T')[0];

        for (const cls of classes) {
            if (!cls.end_time || !cls.schedule_days) continue;

            const schedule = cls.schedule_days.toLowerCase();
            const isScheduledDay = schedule.includes(currentDayName.toLowerCase()) || 
                                 schedule.includes(currentFullDayName.toLowerCase()) ||
                                 (currentDayName === 'Thu' && schedule.includes('thurs')) ||
                                 (currentDayName === 'Wed' && schedule.includes('weds'));

            if (!isScheduledDay) continue;

            // Check if class ended > 30 minutes ago
            const classEndTime = new Date(`${todayStr}T${cls.end_time}+08:00`);
            const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000);

            if (manilaTime < gracePeriodEnd) continue;

            // 1. Get enrolled student IDs
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('student_id')
                .eq('class_id', cls.id);

            if (!enrollments || enrollments.length === 0) continue;

            // 2. Get students who already have logs for today
            const { data: logs } = await supabase
                .from('attendance_logs')
                .select('student_id')
                .eq('class_id', cls.id)
                .gte('timestamp', `${todayStr}T00:00:00+08:00`)
                .lte('timestamp', `${todayStr}T23:59:59+08:00`);

            const loggedStudentIds = new Set(logs?.map(l => l.student_id) || []);
            const missingStudents = enrollments.filter(e => !loggedStudentIds.has(e.student_id));

            if (missingStudents.length > 0) {
                // IMPORTANT: Use auth_user_id for user_id field to avoid RLS failures
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const targetAuthId = (cls.instructors as any)?.auth_user_id;

                const absentRecords = missingStudents.map(s => ({
                    student_id: s.student_id,
                    class_id: cls.id,
                    user_id: targetAuthId,
                    status: 'Absent',
                    timestamp: new Date().toISOString()
                }));

                const { error: insertError } = await supabase
                    .from('attendance_logs')
                    .insert(absentRecords);

                if (!insertError) {
                    results.push({
                        class: cls.name,
                        absent_count: missingStudents.length
                    });
                }
            }
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (error) {
        console.error('Finalize Cron Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
