import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const sin = searchParams.get('sin');

    if (!sin) {
        return NextResponse.json({ error: 'SIN is required' }, { status: 400 });
    }

    try {
        // 1. Get the student ID from the SIN
        const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('id, name')
            .eq('sin', sin)
            .single();

        if (studentError || !studentData) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        const studentId = studentData.id;

        // 2. Fetch all classes the student is enrolled in
        const { data: enrollmentData, error: enrollmentError } = await supabase
            .from('enrollments')
            .select(`
                class_id,
                classes(id, subject_name, section, year_level)
            `)
            .eq('student_id', studentId);

        if (enrollmentError) {
            console.error('Enrollment fetch error:', enrollmentError);
            return NextResponse.json({ error: 'Failed to fetch enrolled classes' }, { status: 500 });
        }

        const enrolledClasses = enrollmentData.flatMap(e => {
            if (!e.classes) return [];
            return Array.isArray(e.classes) ? e.classes : [e.classes];
        });

        // 3. Fetch all attendance records for the student
        const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('class_id, status')
            .eq('student_id', studentId);

        if (attendanceError) {
            console.error('Attendance fetch error:', attendanceError);
            return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 });
        }

        // 4. Calculate stats per class
        const classStatsList = enrolledClasses.map(cls => {
            const records = attendanceData.filter(a => a.class_id === cls?.id);
            const present = records.filter(a => a.status === 'Present').length;
            const late = records.filter(a => a.status === 'Late').length;
            const absent = records.filter(a => a.status === 'Absent').length;
            const excuse_pending = records.filter(a => a.status === 'Excuse Pending').length;
            const total = records.length;

            // Assuming 100% attendance if no sessions yet, else calculate %
            const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

            return {
                id: cls?.id,
                subject_name: cls?.subject_name,
                section: cls?.section,
                year_level: cls?.year_level,
                present,
                late,
                absent,
                excuse_pending,
                total,
                percentage
            };
        });

        // 5. Calculate overall stats
        const overallTotal = attendanceData.length;
        const overallPresent = attendanceData.filter(a => a.status === 'Present').length;
        const overallLate = attendanceData.filter(a => a.status === 'Late').length;
        const overallAbsent = attendanceData.filter(a => a.status === 'Absent').length;
        const overallExcusePending = attendanceData.filter(a => a.status === 'Excuse Pending').length;

        const overallPercentage = overallTotal > 0
            ? Math.round(((overallPresent + overallLate) / overallTotal) * 100)
            : 100;

        const overallStats = {
            total: overallTotal,
            present: overallPresent,
            late: overallLate,
            absent: overallAbsent,
            excuse_pending: overallExcusePending,
            percentage: overallPercentage
        };

        return NextResponse.json({
            student: studentData,
            overall_stats: overallStats,
            class_stats: classStatsList,
            recent_logs: attendanceData.slice(0, 10) // Might need date sorting if required
        }, { status: 200 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
