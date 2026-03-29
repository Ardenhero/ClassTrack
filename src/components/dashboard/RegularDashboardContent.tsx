import { createClient } from "@/utils/supabase/server";
import { Users, UserCheck, Clock, Calendar, BookOpen, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { subDays, format } from "date-fns";
import { getNowManila, toManilaDateString, getManilaStartOfDay, isClassStillOngoing, MANILA_TZ, formatInManila } from "@/utils/time";
import { toZonedTime } from "date-fns-tz";
import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { AttendanceConcernsList } from "@/components/dashboard/AttendanceConcernsList";
import dynamic from "next/dynamic";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

const AttendanceChart = dynamic(() => import("@/components/AttendanceChart").then(mod => mod.AttendanceChart), {
    ssr: false,
    loading: () => <Skeleton className="h-[350px] w-full" variant="rounded" />
});

const IoTSwitches = dynamic(() => import("@/components/IoTSwitches").then(mod => mod.IoTSwitches), {
    ssr: false,
    loading: () => <CardSkeleton />
});

interface AttendanceRecord {
    timestamp: string;
    time_out: string | null;
    status: string;
    class_id?: string;
    student_id?: string;
    classes: { id: string; name: string; instructor_id: string; end_time: string | null } | null;
}

interface ScanRecord {
    timestamp: string;
    status: string;
    student_id: string;
    students: { name: string } | null;
    classes: { name: string; id: string; instructor_id: string } | null;
}

export default async function RegularDashboardContent({
    profileId,
    isActiveAdmin,
    accountInstructorIds,
    activeTermId
}: {
    profileId: string;
    isActiveAdmin: boolean;
    accountInstructorIds: string[];
    activeTermId?: string;
}) {
    const supabase = createClient();
    
    const nowManila = getNowManila();
    const todayStr = toManilaDateString(new Date());
    const todayStartStr = getManilaStartOfDay(new Date());

    const thirtyDaysStart = subDays(new Date(), 29).toISOString();
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDaysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const currentDayName = daysArr[nowManila.getDay()];
    const currentFullDayName = fullDaysArr[nowManila.getDay()];

    // Determine instructor scope for filtering
    const instructorIds = isActiveAdmin && accountInstructorIds.length > 0
        ? accountInstructorIds
        : (!isActiveAdmin && profileId ? [profileId] : []);
    const instructorFilterField = 'instructor_id';

    // --- Build all queries ---
    let createdStudentsQuery = supabase.from('students').select('id');
    let enrolledStudentsQuery = supabase.from('enrollments').select('student_id, students(name), class_id, classes!inner(id, name, instructor_id, created_at, term_id)');
    if (activeTermId) {
        enrolledStudentsQuery = enrolledStudentsQuery.eq('classes.term_id', activeTermId);
    }

    if (instructorIds.length > 0) {
        createdStudentsQuery = createdStudentsQuery.in(instructorFilterField, instructorIds);
        enrolledStudentsQuery = enrolledStudentsQuery.in('classes.instructor_id', instructorIds);
    }

    // Today's Recent Scans (last 10) for the Live Activity Feed
    let recentScansQuery = supabase
        .from('attendance_logs')
        .select('timestamp, status, student_id, students(name), classes!inner(name, instructor_id, term_id)')
        .gte('timestamp', todayStartStr)
        .order('timestamp', { ascending: false })
        .limit(10);

    if (activeTermId) {
        recentScansQuery = recentScansQuery.eq('classes.term_id', activeTermId);
    }

    if (instructorIds.length > 0) {
        recentScansQuery = recentScansQuery.in('classes.instructor_id', instructorIds);
    }

    // Class count query
    let classQuery = supabase.from('classes').select('*', { count: 'exact', head: true });
    if (activeTermId) {
        classQuery = classQuery.eq('term_id', activeTermId);
    }
    if (instructorIds.length > 0) {
        classQuery = classQuery.in(instructorFilterField, instructorIds);
    } else if (isActiveAdmin && accountInstructorIds.length === 0) {
        classQuery = classQuery.eq(instructorFilterField, '00000000-0000-0000-0000-000000000000');
    }

    // 14-day trend logs
    let trendLogsQuery = supabase
        .from('attendance_logs')
        .select('timestamp, time_out, status, student_id, classes!inner(id, name, instructor_id, end_time, term_id)')
        .gte('timestamp', thirtyDaysStart);
    if (activeTermId) {
        trendLogsQuery = trendLogsQuery.eq('classes.term_id', activeTermId);
    }
    if (instructorIds.length > 0) {
        trendLogsQuery = trendLogsQuery.in('classes.instructor_id', instructorIds);
    }

    // Late count (today)
    let lateQuery = supabase
        .from('attendance_logs')
        .select('*, classes!inner(instructor_id, term_id)', { count: 'exact', head: true })
        .eq('status', 'Late')
        .gte('timestamp', todayStartStr);
    if (activeTermId) {
        lateQuery = lateQuery.eq('classes.term_id', activeTermId);
    }
    if (instructorIds.length > 0) {
        lateQuery = lateQuery.in('classes.instructor_id', instructorIds);
    }

    // 30-day class breakdown
    let classBreakdownQuery = supabase
        .from('attendance_logs')
        .select('timestamp, time_out, status, class_id, student_id, classes!inner(id, name, instructor_id, end_time, term_id)')
        .gte('timestamp', thirtyDaysAgo);
    if (activeTermId) {
        classBreakdownQuery = classBreakdownQuery.eq('classes.term_id', activeTermId);
    }
    if (instructorIds.length > 0) {
        classBreakdownQuery = classBreakdownQuery.in('classes.instructor_id', instructorIds);
    }

    // Classes list (for upcoming class widget)
    let classesListQuery = supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    if (activeTermId) {
        classesListQuery = classesListQuery.eq('term_id', activeTermId);
    }
    if (instructorIds.length > 0) {
        classesListQuery = classesListQuery.in(instructorFilterField, instructorIds);
    } else if (isActiveAdmin && accountInstructorIds.length === 0) {
        classesListQuery = classesListQuery.eq(instructorFilterField, '00000000-0000-0000-0000-000000000000');
    }

    // ⚡ FIRE ALL 8 QUERIES IN PARALLEL
    const overridesQuery = supabase
        .from('class_day_overrides')
        .select('class_id, date, type')
        .gte('date', thirtyDaysAgo.split('T')[0]);
    const [
        { data: createdIds },
        { data: enrolledDataRaw },
        { count: classCount },
        { data: trendLogsRaw },
        { count: lateCount },
        { data: breakdownLogsRaw },
        { data: classesRaw },
        { data: recentScansRaw },
        { data: overridesRaw },
    ] = await Promise.all([
        createdStudentsQuery,
        enrolledStudentsQuery,
        classQuery,
        trendLogsQuery,
        lateQuery,
        classBreakdownQuery,
        classesListQuery,
        recentScansQuery,
        overridesQuery,
    ]);

    interface ClassRecord {
        id: string;
        name: string;
        start_time: string;
        end_time: string;
        schedule_days: string;
        term_id: string;
    }

    interface EnrollmentRecord {
        student_id: string;
        students?: { name: string | null; id?: string };
        class_id: string;
        classes?: { name: string; created_at: string; schedule_days?: string; end_time?: string; id?: string };
    }

    const trendLogs = (trendLogsRaw || []) as unknown as AttendanceRecord[];
    const recentScans = (recentScansRaw || []) as unknown as ScanRecord[];
    const dayOverrides = (overridesRaw || []) as { class_id: string; date: string; type: string }[];
    const classes = (classesRaw || []) as unknown as ClassRecord[];
    const enrolledData = (enrolledDataRaw || []) as unknown as EnrollmentRecord[];

    // Compute student count from parallel results
    const enrollmentCounts = new Map<string, number>();
    enrolledData?.forEach(e => {
        const cid = e.class_id;
        if (cid) enrollmentCounts.set(cid, (enrollmentCounts.get(cid) || 0) + 1);
    });

    const uniqueStudentIds = new Set([
        ...(createdIds?.map(s => (s as { id: string }).id) || []),
        ...(enrolledData?.map(e => e.student_id) || [])
    ]);
    const studentCount = uniqueStudentIds.size;

    // Process 14-day trend (CPU-only)
    // 🔃 SYNC today to Manila for chart slotting
    const todayRaw = new Date();
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = subDays(todayRaw, 13 - i);
        return {
            dateObj: d,
            date: formatInManila(d, 'MMM dd'),
            present: 0,
            late: 0,
            absent: 0
        };
    });

    // Build a set of overridden keys so we can skip physical logs on suspended days
    const overriddenKeys = new Set<string>();
    dayOverrides.forEach(o => {
        if (['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)) {
            overriddenKeys.add(`${o.date}:${o.class_id}`);
        }
    });

    // Process Physical Logs with proper deduplication (Priority: Late > Present > Absent)
    const allRelevantLogs = (breakdownLogsRaw || []) as unknown as AttendanceRecord[];
    const logsByDayAndClass = new Map<string, Set<string>>(); // "dateStr:classId" -> Set of studentIds
    
    // 1. Process Physical Logs with proper deduplication
    const bestStatusByStudent = new Map<string, string>();
    allRelevantLogs.forEach((log) => {
        const dStr = toManilaDateString(log.timestamp);
        const cid = log.class_id || log.classes?.id;
        if (!cid || !log.student_id) return;

        // Skip logs on overridden (suspended/cancelled/holiday) days
        if (overriddenKeys.has(`${dStr}:${cid}`)) return;

        const studentKey = `${dStr}:${cid}:${log.student_id}`;
        
        let status = log.status;
        const endTimeStr = log.classes?.end_time;
        if (status === 'Present' && !log.time_out && endTimeStr) {
            if (!isClassStillOngoing(dStr, endTimeStr)) {
                status = 'Absent';
            }
        }
        
        const existing = bestStatusByStudent.get(studentKey);
        if (!existing) {
            bestStatusByStudent.set(studentKey, status);
        } else {
            // Priority: Late > Present > Absent
            if (status === 'Late') {
                bestStatusByStudent.set(studentKey, 'Late');
            } else if (status === 'Present' && existing === 'Absent') {
                bestStatusByStudent.set(studentKey, 'Present');
            }
        }
    });

    // Stats for class breakdown (30 days)
    type ClassStats = { className: string; id: string; present: number; late: number; absent: number };
    const classStatsMap = new Map<string, ClassStats>();
    classes?.forEach((cls) => {
        classStatsMap.set(cls.id, { className: cls.name, id: cls.id, present: 0, late: 0, absent: 0 });
    });

    // Populate chart data and stats map from deduplicated PHYSICAL logs
    bestStatusByStudent.forEach((status, studentKey) => {
        const [dStr, cid, sid] = studentKey.split(':');
        
        // Track unique logs per student/class/day for synthetic exclusion
        const key = `${dStr}:${cid}`;
        if (!logsByDayAndClass.has(key)) logsByDayAndClass.set(key, new Set());
        logsByDayAndClass.get(key)!.add(sid);

        const dayStat = last14Days.find(d => toManilaDateString(d.dateObj) === dStr);
        if (dayStat) {
            if (status === 'Present') dayStat.present++;
            else if (status === 'Late') dayStat.late++;
            else if (status === 'Absent' || status === 'Left Early' || status === 'Cut Class') dayStat.absent++;
        }

        const stats = classStatsMap.get(cid);
        if (stats) {
            if (status === 'Present') stats.present++;
            else if (status === 'Late') stats.late++;
            else if (status === 'Absent' || status === 'Left Early' || status === 'Cut Class') stats.absent++;
        }
    });

    const todaysLogs = trendLogs?.filter((l: AttendanceRecord) => l.timestamp >= todayStartStr) || [];
    let presentCount = 0;
    todaysLogs.forEach((l: AttendanceRecord) => {
        let effStatus = l.status;
        const eTimeStr = (l.classes as { end_time?: string } | undefined)?.end_time;
        if (effStatus === 'Present' && !l.time_out && eTimeStr) {
            const logDateOnly = l.timestamp.split('T')[0];
            if (!isClassStillOngoing(logDateOnly, eTimeStr)) {
                effStatus = 'Absent';
            }
        }
        if (effStatus && (effStatus.toLowerCase() === 'present' || effStatus.toLowerCase() === 'late')) presentCount++;
    });


    // ─── NO-CRON DYNAMIC CHART SYNC: Inject historical missed attendances ───
    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(todayRaw, 29 - i);
        return {
            dateObj: d,
            dateStr: formatInManila(d, 'yyyy-MM-dd'),
            dayName: daysArr[d.getDay()],
            fullDayName: fullDaysArr[d.getDay()]
        };
    });

    // 3. Synthetic Gap Calculation: (Enrolled - TotalLogs)
    last30Days.forEach((dayInfo) => {
        if (dayInfo.dateStr > todayStr) return; // Skip future

        classes?.forEach((cls) => {
            const scheduleStr = cls.schedule_days?.toLowerCase() || '';
            const wasScheduled = scheduleStr.includes(dayInfo.dayName.toLowerCase()) || 
                          scheduleStr.includes(dayInfo.fullDayName.toLowerCase()) ||
                          (dayInfo.dayName === 'Thu' && scheduleStr.includes('thurs')) ||
                          (dayInfo.dayName === 'Wed' && scheduleStr.includes('weds'));
            if (!wasScheduled) return;

            if (dayInfo.dateStr === todayStr) {
                if (cls.end_time && isClassStillOngoing(dayInfo.dateStr, cls.end_time)) return;
            }

            // Check overrides
            if (dayOverrides?.some(o => o.class_id === cls.id && o.date === dayInfo.dateStr && ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type))) return;

            const enrollmentCountForClass = enrollmentCounts.get(cls.id) || 0;
            const logCountOnDay = logsByDayAndClass.get(`${dayInfo.dateStr}:${cls.id}`)?.size || 0;
            const missingCount = Math.max(0, enrollmentCountForClass - logCountOnDay);

            if (missingCount > 0) {
                // Add to 14-day trend
                const dayStat = last14Days.find(d => formatInManila(d.dateObj, 'yyyy-MM-dd') === dayInfo.dateStr);
                if (dayStat) dayStat.absent += missingCount;

                // Add to 30-day class breakdown
                const stats = classStatsMap.get(cls.id);
                if (stats) stats.absent += missingCount;
            }
        });
    });


    // (Top 10 concerns still uses studentAbsenceMap calculated on the fly as it needs student details)
    const studentAbsenceMap = new Map<string, { name: string; className: string; absent: number }>();
    const processedEnrollmentKeys = new Set<string>();
    (enrolledData || []).forEach(enrollment => {
        const studentId = enrollment.student_id;
        const studentName = enrollment.students?.name || 'Unknown Student';
        const classId = enrollment.class_id;
        const className = enrollment.classes?.name || 'Unknown Class';
        const classCreatedDate = enrollment.classes?.created_at ? new Date(enrollment.classes.created_at) : new Date('2024-01-01');

        const enrollmentKey = `${studentId}-${classId}`;
        if (processedEnrollmentKeys.has(enrollmentKey)) return;
        processedEnrollmentKeys.add(enrollmentKey);

        if (!studentAbsenceMap.has(enrollmentKey)) {
            studentAbsenceMap.set(enrollmentKey, { name: studentName, className, absent: 0 });
        }
        const record = studentAbsenceMap.get(enrollmentKey)!;

        last30Days.forEach(dayInfo => {
            if (dayInfo.dateObj < classCreatedDate) return;
            const cls = classes?.find(c => c.id === classId);
            if (!cls || !cls.schedule_days) return;

            const scheduleStr = cls.schedule_days.toLowerCase();
            const wasScheduled = scheduleStr.includes(dayInfo.dayName.toLowerCase()) || 
                          scheduleStr.includes(dayInfo.fullDayName.toLowerCase()) ||
                          (dayInfo.dayName === 'Thu' && scheduleStr.includes('thurs')) ||
                          (dayInfo.dayName === 'Wed' && scheduleStr.includes('weds'));
            if (!wasScheduled) return;

            const logKey = `${dayInfo.dateStr}:${classId}`;
            const hasLog = logsByDayAndClass.get(logKey)?.has(studentId);

            if (!hasLog) {
                if (dayInfo.dateStr === todayStr) {
                    if (cls.end_time && isClassStillOngoing(dayInfo.dateStr, cls.end_time)) return;
                }
                const hasNoClassOverride = dayOverrides.some(o => o.class_id === classId && o.date === dayInfo.dateStr && ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type));
                if (!hasNoClassOverride) record.absent++;
            }
        });
    });

    const attendanceConcerns = Array.from(studentAbsenceMap.values())
        .filter(s => s.absent > 3)
        .sort((a, b) => b.absent - a.absent);

    const trendData = last14Days.map(d => ({
        date: d.date,
        present: d.present,
        late: d.late,
        absent: d.absent
    }));

    // (Moved to top for consistency)

    const upcomingClassesRaw = classes?.map(c => {
        if (!c.start_time || !c.end_time || !c.schedule_days) return null;

        // Robust Day Matching (Case-insensitive, supports "Sat", "Saturday", etc.)
        const scheduleStr = c.schedule_days.toLowerCase();
        const isToday = scheduleStr.includes(currentDayName.toLowerCase()) || 
                      scheduleStr.includes(currentFullDayName.toLowerCase()) ||
                      (currentDayName === 'Thu' && scheduleStr.includes('thurs')) ||
                      (currentDayName === 'Wed' && scheduleStr.includes('weds'));
        
        if (!isToday) return null;

        // Robust Time Parsing (Environment-independent)
        const parseTimeStr = (timeStr: string) => {
            try {
                // Normalize: "8:00 AM" or "08:00AM" -> "8:00 AM"
                const norm = timeStr.trim().toUpperCase().replace(/([AP]M)/, ' $1').replace(/\s+/g, ' ');
                let hrs = 0, mins = 0;
                
                if (norm.includes('M')) {
                    const [timePart, ampm] = norm.split(' ');
                    const [h, m] = (timePart.includes(':') ? timePart : `${timePart}:00`).split(':').map(Number);
                    hrs = ampm === 'PM' && h !== 12 ? h + 12 : (ampm === 'AM' && h === 12 ? 0 : h);
                    mins = m || 0;
                } else {
                    const [h, m] = (norm.includes(':') ? norm : `${norm}:00`).split(':').map(Number);
                    hrs = h;
                    mins = m || 0;
                }
                
                const d = toZonedTime(new Date(), MANILA_TZ);
                d.setHours(hrs, mins, 0, 0); 
                return d;
            } catch { return null; }
        };

        const startTimeObj = parseTimeStr(c.start_time);
        const endTimeObj = parseTimeStr(c.end_time);

        if (!startTimeObj || !endTimeObj) return null;

        const attendanceOpen = new Date(startTimeObj.getTime() - 15 * 60 * 1000);

        let status = 'hidden';
        const isLive = nowManila >= attendanceOpen && nowManila <= endTimeObj;
        const isUpcoming = nowManila < attendanceOpen;
        const isCompleted = nowManila > endTimeObj;

        if (isLive) status = 'live';
        else if (isUpcoming) status = 'upcoming';
        else if (isCompleted) status = 'completed';

        // Filter: Show only if it's currently live or still in the future for today
        if (status === 'completed' || status === 'hidden') return null;
        return { ...c, status, startTimeObj, endTimeObj };
    }) || [];

    const upcomingClasses = upcomingClassesRaw.filter(Boolean) as {
        id: string;
        name: string;
        status: string;
        startTimeObj: Date;
        endTimeObj: Date;
        end_time: string;
    }[];

    const currentlyActiveClasses = upcomingClasses.filter(c => c.status === 'live').length;

    upcomingClasses.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return (a.startTimeObj.getTime() || 0) - (b.startTimeObj.getTime() || 0);
    });

    const activeOrNextClass = upcomingClasses[0];

    return (
        <>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your classes and student attendance</p>
                </div>
                <div className="flex items-center space-x-3">
                    <DashboardActions 
                        instructorId={profileId} 
                        classes={(classes || []).map(c => ({ id: c.id, name: c.name, schedule_days: c.schedule_days, term_id: c.term_id }))} 
                    />
                    <Link href="/students" className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium">
                        Manage Students
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Link href="/classes" className="group">
                    <div className="bg-nwu-red rounded-3xl p-6 text-white relative overflow-hidden shadow-sm transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgb(142,13,14,0.3)] h-full">
                        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                            <BookOpen className="h-32 w-32" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-white/80">Total Classes</p>
                                <div className="p-2 bg-white/20 rounded-full">
                                    <BookOpen className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="text-4xl font-bold mb-2">
                                <span className="text-white">{classCount || 0}</span>
                            </h2>
                            <div className="inline-flex items-center px-2 py-1 bg-white/20 rounded-lg text-xs font-medium">
                                <span className="mr-1">↑</span> {currentlyActiveClasses} active today
                            </div>
                        </div>
                    </div>
                </Link>

                <Link href="/students" className="group">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Students</p>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{studentCount || 0}</h2>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full text-gray-400">
                                <Users className="h-5 w-5" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Enrolled across all years</p>
                    </div>
                </Link>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(16,185,129,0.15)] dark:hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)]">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Present Today</p>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{presentCount}</h2>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-full text-green-600 dark:text-green-400">
                            <UserCheck className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-2 bg-green-50 dark:bg-green-900/20 inline-block px-2 py-1 rounded w-max">
                        {studentCount ? Math.round((presentCount / studentCount) * 100) : 0}% Attendance Rate
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(245,158,11,0.15)] dark:hover:shadow-[0_8px_30px_rgb(245,158,11,0.1)]">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Pending/Late</p>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{lateCount || 0}</h2>
                        </div>
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-full text-yellow-600 dark:text-yellow-400">
                            <Clock className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Students marked late today</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 h-full">
                    <AttendanceChart data={trendData} />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                            {activeOrNextClass?.status === 'live' ? 'Ongoing Class' : 'Upcoming Class'}
                        </h3>
                        <Link href="/classes">
                            <button 
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="View more class options"
                            >
                                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </Link>
                    </div>

                    <div className="space-y-4 flex-1">
                        {activeOrNextClass ? (
                            <div className={`p-4 rounded-2xl border ${activeOrNextClass.status === 'live' ? 'bg-nwu-red/5 border-nwu-red/20' : 'bg-gray-50 dark:bg-gray-700 border-gray-100 dark:border-gray-600'}`} data-testid="upcoming-class">
                                <div className="flex items-start">
                                    <div className={`p-2 rounded-lg shadow-sm mr-3 ${activeOrNextClass.status === 'live' ? 'bg-nwu-red text-white' : 'bg-white dark:bg-gray-600 text-nwu-red'}`}>
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{activeOrNextClass.name}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            <span data-testid="upcoming-class-time">{activeOrNextClass.startTimeObj ? format(activeOrNextClass.startTimeObj, 'h:mm a') : 'TBD'}</span>
                                            {' - '}
                                            {activeOrNextClass.endTimeObj ? format(activeOrNextClass.endTimeObj, 'h:mm a') : 'TBD'}
                                        </p>
                                        
                                        {activeOrNextClass.status === 'live' && (
                                            <div className="mt-2">
                                                <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                                                    <span>CLASS CHECK-IN</span>
                                                    <span>
                                                        {todaysLogs.filter(l => 
                                                            l.classes?.id === activeOrNextClass.id && 
                                                            l.status && (l.status.toLowerCase() === 'present' || l.status.toLowerCase() === 'late')
                                                        ).length} / {enrollmentCounts.get(activeOrNextClass.id) || 0}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-nwu-red rounded-full transition-all duration-500"
                                                        style={{ 
                                                            width: `${Math.min(100, (todaysLogs.filter(l => l.classes?.id === activeOrNextClass.id && l.status === 'Present').length / (enrollmentCounts.get(activeOrNextClass.id) || 1)) * 100)}%` 
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Link href={`/classes/${activeOrNextClass.id}`} className="block w-full mt-4">
                                    <button className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${activeOrNextClass.status === 'live'
                                        ? 'bg-nwu-red text-white hover:bg-red-700 hover:shadow-md'
                                        : 'bg-gray-900 dark:bg-black text-white hover:bg-gray-800'
                                        }`}>
                                        View Attendance
                                    </button>
                                </Link>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600" data-testid="upcoming-class">
                                <p className="text-sm font-medium">No sessions remaining today</p>
                                <p className="text-[10px] text-gray-400 mt-1">Enjoy your evening!</p>
                            </div>
                        )}
                        <div className="pt-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                {activeOrNextClass?.status === 'live' ? "Live Activity Feed" : "Today's Activity"}
                            </p>
                            <div className="space-y-3">
                                {recentScans && recentScans.length > 0 ? (
                                    recentScans.slice(0, 3).map((scan, idx) => {
                                        // Force Manila timezone for display
                                        const scanTime = new Intl.DateTimeFormat('en-US', {
                                            timeZone: 'Asia/Manila',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        }).format(new Date(scan.timestamp));

                                        return (
                                            <div key={idx} className="flex items-center p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold mr-3 ${
                                                    scan.status?.toLowerCase() === 'present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {scan.students?.name?.[0] || 'S'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{scan.students?.name}</p>
                                                    <p className="text-[10px] text-gray-400 truncate">{scan.classes?.name}</p>
                                                </div>
                                                <div className="text-[10px] font-mono text-gray-400">
                                                    {scanTime}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4 text-[10px] text-gray-400 font-medium italic">
                                        No recent scans detected
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Students with Attendance Concerns</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Students with more than 3 absences in a class (Last 30 Days)</p>
                            </div>
                        </div>

                        <div className="overflow-hidden flex-1 flex flex-col">
                            <AttendanceConcernsList attendanceConcerns={attendanceConcerns} />
                        </div>
                    </div>
                </div>

                <IoTSwitches />
            </div>
        </>
    );
}
