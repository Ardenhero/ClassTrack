import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getStudentSession } from '@/app/student/portal/actions';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

interface AttendanceLog {
    class_id: string; // Corrected to string (UUID)
    status: string | null;
    timestamp: string;
    time_out: string | null;
    student_id: string; // Corrected to string (UUID)
}

interface ClassData {
    id: string;
    name: string;
    year_level: string | null;
    section?: string | null; // Make optional
    instructor_id: string;
    start_time: string | null;
    end_time: string | null;
    department: string | null;
    schedule_days?: string | null;
    created_at?: string | null;
}

interface DayOverride {
    class_id: string;
    date: string;
    type: string;
}

export async function GET(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const sin = searchParams.get('sin');
    const role = searchParams.get('role');
    const instructorId = searchParams.get('instructorId');
    const termId = searchParams.get('termId');

    if (!sin) {
        return NextResponse.json({ error: 'SIN is required' }, { status: 400 });
    }

    // SECURITY CHECK: Verify student session if not an instructor/admin
    if (!role) {
        const session = await getStudentSession();
        if (!session || session.sin !== sin) {
            return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
        }
    } else {
        // Instructor/Admin Check: Verify they have a valid Supabase session
        const supabaseServer = createServerClient();
        const { data: { user } } = await supabaseServer.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
        }
    }

    try {
        const nowManila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const todayStr = nowManila.toISOString().split('T')[0];

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

        // 2. Fetch classes the student is enrolled in
        let activeTermId = termId;
        if (!activeTermId) {
            const { data: activeTerm } = await supabase
                .from('academic_terms')
                .select('id')
                .eq('is_active', true)
                .single();
            if (activeTerm) activeTermId = activeTerm.id;
        }

        let enrollmentQuery = supabase
            .from('enrollments')
            .select(`
                class_id,
                enrolled_at,
                classes!inner(id, name, year_level, instructor_id, start_time, end_time, department, schedule_days, created_at, term_id)
            `)
            .eq('student_id', studentId);

        if (activeTermId) {
            enrollmentQuery = enrollmentQuery.eq('classes.term_id', activeTermId);
        }

        // If the viewer is an instructor, we only want to show classes they teach
        // BUT if they are an admin, they should see everything in the pool
        if (role === 'instructor' && instructorId) {
            enrollmentQuery = enrollmentQuery.eq('classes.instructor_id', instructorId);
        } else if (role === 'admin' && instructorId) {
            const { data: adminDept } = await supabase
                .from('instructors')
                .select('department')
                .eq('id', instructorId)
                .single();

            if (adminDept?.department) {
                enrollmentQuery = enrollmentQuery.eq('classes.department', adminDept.department);
            }
        }

        const { data: enrollmentData, error: enrollmentError } = await enrollmentQuery;

        if (enrollmentError) {
            console.error('Enrollment fetch error:', enrollmentError);
            return NextResponse.json({ error: 'Failed to fetch enrolled classes' }, { status: 500 });
        }

        const enrolledClasses = (enrollmentData || []).flatMap(e => {
            if (!e.classes) return [];
            return (Array.isArray(e.classes) ? e.classes : [e.classes]);
        }) as ClassData[];

        const allowedClassIds = enrolledClasses.map(c => c.id).filter(id => !!id);

        // 3. Fetch attendance records
        let attendanceLogs: AttendanceLog[] = [];
        if (allowedClassIds.length > 0) {
            const { data, error: attendanceError } = await supabase
                .from('attendance_logs')
                .select('class_id, status, timestamp, time_out, student_id')
                .eq('student_id', studentId)
                .in('class_id', allowedClassIds);

            if (attendanceError) {
                console.error('Attendance fetch error:', attendanceError);
            }
            attendanceLogs = data || [];
        }

        // 3.5 Fetch class day overrides (to prevent synthetic absences on "No Class" days)
        let dayOverrides: DayOverride[] = [];
        if (allowedClassIds.length > 0) {
            const { data: overrideData } = await supabase
                .from('class_day_overrides')
                .select('class_id, date, type')
                .in('class_id', allowedClassIds);
            dayOverrides = overrideData || [];
        }

        // Helper to resolve effective status
        const resolveStatus = (log: AttendanceLog, classData: ClassData | undefined) => {
            const status = log.status || 'Present';
            if (status.toLowerCase() !== 'present' && status.toLowerCase() !== 'late') return status;

            // Check for missed timeout
            if (!log.time_out && classData?.end_time) {
                const logDate = log.timestamp.split('T')[0];
                const classEndTime = new Date(`${logDate}T${classData.end_time}+08:00`);
                const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000); // 30 min grace

                // Compare with current Manila time
                const nowManila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

                if (nowManila > gracePeriodEnd) {
                    return 'Absent';
                }
            }
            return status;
        };

        // 4. Calculate stats per class
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const manilaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });

        const classStatsList = enrolledClasses.map(cls => {
            const clsId = String(cls?.id || '').toLowerCase().trim();

            const records = attendanceLogs.filter(a =>
                String(a.class_id || '').toLowerCase().trim() === clsId
            );

            let present = 0, late = 0, excused = 0;
            const logDatesWithActivity = new Set<string>();

            records.forEach(log => {
                const logDateStr = manilaFormatter.format(new Date(log.timestamp));

                // Check for No Class overrides on this specific log's day
                const hasOverride = dayOverrides.some(o =>
                    o.class_id === cls.id &&
                    o.date === logDateStr &&
                    ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)
                );

                if (hasOverride) return; // Ignore logs on cancelled class days

                logDatesWithActivity.add(logDateStr);
                const resolved = resolveStatus(log, cls).toLowerCase();
                if (resolved === 'present' || resolved === 'present ') present++;
                else if (resolved === 'late') late++;
                else if (resolved === 'excused' || resolved.includes('excuse')) excused++;
            });

            // --- NO-CRON DYNAMIC SYNC: Handle historical missed sessions (All-Time) ---
            const enrollmentDateStr = enrollmentData.find(e => e.class_id === cls.id)?.enrolled_at;
            const enrollmentDate = enrollmentDateStr ? new Date(enrollmentDateStr) : (cls.created_at ? new Date(cls.created_at) : new Date('2024-01-01'));

            // The start date for synthetic absences should be the LATER of (class creation, enrollment date)
            const classCreatedDate = cls.created_at ? new Date(cls.created_at) : new Date('2024-01-01');
            const effectiveStartDate = enrollmentDate > classCreatedDate ? enrollmentDate : classCreatedDate;

            const totalDaysBack = Math.min(365, differenceInDays(nowManila, effectiveStartDate) + 1);

            const pastDays = Array.from({ length: totalDaysBack }, (_, i) => {
                const d = subDays(nowManila, (totalDaysBack - 1) - i);
                return {
                    dateStr: manilaFormatter.format(d),
                    dayName: dayNames[d.getDay()],
                    dateObj: d
                };
            });

            let syntheticAbsences = 0;
            pastDays.forEach(dayInfo => {
                if (dayInfo.dateObj < effectiveStartDate) return;

                const isScheduledOnDay = cls.schedule_days?.toLowerCase().includes(dayInfo.dayName.toLowerCase()) ||
                    (dayInfo.dayName === 'Thu' && cls.schedule_days?.toLowerCase().includes('thurs')) ||
                    (dayInfo.dayName === 'Wed' && cls.schedule_days?.toLowerCase().includes('weds'));

                if (!isScheduledOnDay) return;

                // If they have ANY activity/log on this day (that wasn't ignored by override), it's not a synthetic absence
                if (logDatesWithActivity.has(dayInfo.dateStr)) return;

                const isTodayStr = dayInfo.dateStr === todayStr;
                const classEndTime = new Date(`${dayInfo.dateStr}T${cls.end_time}+08:00`);
                const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000);

                if (isTodayStr) {
                    if (nowManila < gracePeriodEnd) return;
                }

                // Check for No Class overrides
                const hasNoClassOverride = dayOverrides.some(o =>
                    o.class_id === cls.id &&
                    o.date === dayInfo.dateStr &&
                    ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)
                );

                if (!hasNoClassOverride) {
                    syntheticAbsences++;
                }
            });

            const total = logDatesWithActivity.size + syntheticAbsences;
            const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
            const trueAbsent = Math.max(0, total - present - late - excused);

            return {
                id: cls.id,
                subject_name: cls.name,
                instructor_name: (cls as unknown as { instructors?: { name: string } }).instructors?.name || "Unknown",
                year_level: cls.year_level,
                section: cls.section || "",
                present,
                late,
                absent: trueAbsent,
                excuse_pending: excused,
                total,
                percentage
            };
        });

        // 5. Calculate overall stats with same robust logic

        // 5. Calculate default overall stats
        let ovPresent = 0, ovLate = 0, ovAbsent = 0, ovExcused = 0;

        classStatsList.forEach(stat => {
            ovPresent += stat.present;
            ovLate += stat.late;
            ovAbsent += stat.absent;
            ovExcused += stat.excuse_pending;
        });

        const overallTotal = ovPresent + ovLate + ovAbsent + ovExcused;
        const overallPercentage = overallTotal > 0 ? Math.round(((ovPresent + ovLate) / overallTotal) * 100) : 0;

        // 6. Final Filtering for Dept Admin Privacy (In-Memory)
        let finalClassStats = classStatsList;
        let finalOverallStats = {
            total: overallTotal,
            present: ovPresent,
            late: ovLate,
            absent: ovAbsent,
            excuse_pending: ovExcused,
            percentage: overallPercentage
        };

        if (role === 'admin' && instructorId) {
            // 1. Get viewer's profile to check for Super Admin status and Department ID
            const { data: viewer } = await supabase
                .from('instructors')
                .select('id, department, department_id, is_super_admin')
                .eq('id', instructorId)
                .single();

            if (viewer && !viewer.is_super_admin) {
                // 2. Resolve the official department code (e.g. 'ME', 'CpE') 
                // We use the department_id as the primary source of truth.
                let deptCode = viewer.department;
                if (!deptCode && viewer.department_id) {
                    const { data: dept } = await supabase
                        .from('departments')
                        .select('code')
                        .eq('id', viewer.department_id)
                        .single();
                    if (dept) deptCode = dept.code;
                }

                // 3. Filter the pre-calculated stats by this resolved department code
                if (deptCode) {
                    finalClassStats = classStatsList.filter(stat => {
                        const cls = enrolledClasses.find(e => e.id === stat.id);
                        // Strict case-insensitive match for the department code
                        return cls?.department?.toLowerCase().trim() === deptCode.toLowerCase().trim();
                    });

                    // 4. Recalculate Overall Stats for privacy
                    let p2 = 0, l2 = 0, a2 = 0, e2 = 0;
                    finalClassStats.forEach(s => {
                        p2 += s.present;
                        l2 += s.late;
                        a2 += s.absent;
                        e2 += s.excuse_pending;
                    });
                    const t2 = p2 + l2 + a2 + e2;
                    finalOverallStats = {
                        total: t2,
                        present: p2,
                        late: l2,
                        absent: a2,
                        excuse_pending: e2,
                        percentage: t2 > 0 ? Math.round(((p2 + l2) / t2) * 100) : 0
                    };
                }
            }
        }

        return NextResponse.json({
            student: studentData,
            overall_stats: finalOverallStats,
            class_stats: finalClassStats,
            recent_logs: attendanceLogs.slice(0, 10).map(log => {
                const logDateStr = manilaFormatter.format(new Date(log.timestamp));
                const override = dayOverrides.find(o =>
                    o.class_id === log.class_id &&
                    o.date === logDateStr &&
                    ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)
                );
                if (override) {
                    return { ...log, status: override.type };
                }
                return log;
            }),
            ...(process.env.NODE_ENV === 'development' ? {
                debug: {
                    resolved_student_id: studentId,
                    allowed_class_ids: allowedClassIds,
                    total_logs_fetched: attendanceLogs.length
                }
            } : {})
        }, {
            status: 200,
            headers: {
                'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
            },
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
