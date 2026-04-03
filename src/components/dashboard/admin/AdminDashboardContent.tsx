import { createClient } from "@/utils/supabase/server";
import { Users, GraduationCap, TrendingUp, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { subDays } from "date-fns";
import { getNowManila, toManilaDateString, getManilaStartOfDay, isClassActive, isClassStillOngoing, formatInManila } from "@/utils/time";
import dynamic from "next/dynamic";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { AdminRoomControl } from "@/components/admin/AdminRoomControl";
import { AddClassDialog } from "@/app/classes/AddClassDialog";
import { Plus } from "lucide-react";
import Image from "next/image";

const AttendanceChart = dynamic(() => import("@/components/AttendanceChart").then(mod => mod.AttendanceChart), {
    ssr: false,
    loading: () => <Skeleton className="h-[350px] w-full" variant="rounded" />
});

const KioskHealthCard = dynamic(() => import("@/components/KioskHealthCard").then(mod => mod.KioskHealthCard), {
    ssr: false,
    loading: () => <CardSkeleton />
});

const IoTStatusMonitor = dynamic(() => import("@/components/admin/IoTStatusMonitor").then(mod => mod.IoTStatusMonitor), {
    ssr: false,
    loading: () => <CardSkeleton />
});

export default async function AdminDashboardContent({
    profileId,
    accountInstructorIds,
    activeTermId
}: {
    profileId: string;
    accountInstructorIds: string[];
    activeTermId?: string;
}) {
    const supabase = createClient();

    // ⚡ Standardized Manila Time
    const nowManila = getNowManila();
    const todayStr = toManilaDateString(new Date());
    const todayStartStr = getManilaStartOfDay(new Date());

    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    // ⚡ Fetch Department context to ensure we have ALL instructors for combined analytics
    const { data: profileRecord } = await supabase
        .from('instructors')
        .select('is_super_admin, department')
        .eq('id', profileId)
        .single();

    const isSuperAdmin = profileRecord?.is_super_admin === true;
    let finalInstructorIds = accountInstructorIds;

    // If we're an admin in a department, we MUST see the whole department combined
    if (profileRecord?.department) {
        const { data: deptInstructors } = await supabase
            .from('instructors')
            .select('id')
            .eq('department', profileRecord.department);

        if (deptInstructors && (deptInstructors as { id: string }[]).length > 0) {
            finalInstructorIds = (deptInstructors as { id: string }[]).map(i => i.id);
        }
    }

    // fallback if no department found
    if (finalInstructorIds.length === 0) {
        finalInstructorIds = [profileId];
    }

    const instructorIds = finalInstructorIds;

    // ─── BUILD ALL QUERIES ────────────────────────────────────────────────

    // 1. Total enrollment (unique students across all department classes)
    const enrollmentQuery = supabase
        .from('enrollments')
        .select('student_id, class_id, classes!inner(instructor_id, term_id)')
        .in('classes.instructor_id', instructorIds);
    if (activeTermId) {
        enrollmentQuery.eq('classes.term_id', activeTermId);
    }

    // 2. Created students count (includes unenrolled students)
    const createdStudentsQuery = supabase
        .from('students')
        .select('id, instructor_id')
        .in('instructor_id', instructorIds);

    // 3. Faculty / Instructor list (we filter admin out later)
    const allInstructorsQuery = supabase
        .from('instructors')
        .select('id, name, role, image_url')
        .in('id', instructorIds);

    // 4. Active classes count (only non-admin instructor classes)
    const classCountQuery = supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .in('instructor_id', instructorIds);
    if (activeTermId) {
        classCountQuery.eq('term_id', activeTermId);
    }

    // 5. 30-day class breakdown (Covers both breakdown and trend ranges)
    const breakdownLogsQuery = supabase
        .from('attendance_logs')
        .select('timestamp, time_out, status, class_id, student_id, classes!inner(id, name, instructor_id, end_time, term_id)')
        .gte('timestamp', thirtyDaysAgo)
        .in('classes.instructor_id', instructorIds);
    if (activeTermId) {
        breakdownLogsQuery.eq('classes.term_id', activeTermId);
    }

    // 6. 7-day attendance for rate calculation
    const weekLogsQuery = supabase
        .from('attendance_logs')
        .select('status, time_out, timestamp, classes!inner(instructor_id, end_time, term_id)')
        .gte('timestamp', sevenDaysAgo)
        .in('classes.instructor_id', instructorIds);
    if (activeTermId) {
        weekLogsQuery.eq('classes.term_id', activeTermId);
    }

    // 8. Per-instructor stats (classes + students + recent attendance)
    const instructorClassesQuery = supabase
        .from('classes')
        .select('id, name, instructor_id, start_time, end_time, schedule_days, created_at, term_id')
        .in('instructor_id', instructorIds);
    if (activeTermId) {
        instructorClassesQuery.eq('term_id', activeTermId);
    }

    const recentAttendanceQuery = supabase
        .from('attendance_logs')
        .select('status, time_out, timestamp, class_id, classes!inner(instructor_id, end_time, term_id)')
        .gte('timestamp', sevenDaysAgo)
        .in('classes.instructor_id', instructorIds);
    if (activeTermId) {
        recentAttendanceQuery.eq('classes.term_id', activeTermId);
    }

    const [
        { data: enrolledData },
        { data: createdIds },
        { data: instructorsData },
        , // classCount slot (ignored)
        { data: breakdownLogs },
        , // weekLogs slot (ignored)
        { data: instructorClasses },
        { data: recentAttendance },
        { data: dayOverrides },
    ] = await Promise.all([
        enrollmentQuery,
        createdStudentsQuery,
        allInstructorsQuery,
        classCountQuery,
        breakdownLogsQuery,
        weekLogsQuery,
        instructorClassesQuery,
        recentAttendanceQuery,
        supabase
            .from('class_day_overrides')
            .select('id, class_id, date, type')
            .in('class_id', accountInstructorIds.length > 0 ? accountInstructorIds : [profileId]) // Use initial IDs to avoid waiting for breakdown
    ]);

    // ─── COMPUTE STATS ───────────────────────────────────────────────────

    interface DashboardAttendanceLog {
        timestamp: string;
        time_out: string | null;
        status: string;
        class_id?: string;
        student_id?: string;
        classes: {
            id?: string;
            name?: string;
            instructor_id?: string;
            end_time: string | null;
        } | {
            id?: string;
            name?: string;
            instructor_id?: string;
            end_time: string | null;
        }[];
    }

    interface Instructor {
        id: string;
        name: string | null;
        role: string | null;
        image_url: string | null;
    }

    interface InstructorClass {
        id: string;
        name: string;
        instructor_id: string;
        start_time: string | null;
        end_time: string | null;
        schedule_days: string | null;
        created_at: string;
    }

    // Helper: resolve effective status
    const getEffectiveStatus = (log: DashboardAttendanceLog) => {
        let status = log.status;
        const clsObj = Array.isArray(log.classes) ? log.classes[0] : log.classes;
        const endTimeStr = clsObj?.end_time;
        if (status === 'Present' && !log.time_out && endTimeStr) {
            const manilaLogDate = toManilaDateString(log.timestamp);
            if (!isClassStillOngoing(manilaLogDate, endTimeStr)) {
                status = 'Absent';
            }
        }
        return status;
    };

    // FIX #1 & #4: Filter out admin profiles — only keep actual instructors
    const actualInstructors = (instructorsData as unknown as Instructor[])?.filter((inst) => inst.role !== 'admin') || [];
    const actualInstructorIds = actualInstructors.map((inst) => inst.id);

    // Total unique enrollment (includes unenrolled students created by department instructors)
    const uniqueStudentIds = new Set([
        ...(createdIds as { id: string }[] || []).map((s) => s.id),
        ...(enrolledData as { student_id: string }[] || []).map((e) => e.student_id)
    ]);
    const totalEnrollment = uniqueStudentIds.size;

    // Faculty status — only count actual instructors currently teaching
    const totalFaculty = actualInstructors.length;

    // Robust today detection & Active Class Counters
    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDaysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysArr[nowManila.getDay()];
    const currentFullDayName = fullDaysArr[nowManila.getDay()];

    let classesScheduledTodayCount = 0;
    let currentlyActiveClassesCount = 0;
    const activeInstructorIds = new Set<string>();

    (instructorClasses as unknown as InstructorClass[])?.forEach((c) => {
        if (!actualInstructorIds.includes(c.instructor_id)) return;
        if (!c.schedule_days || !c.start_time || !c.end_time) return;

        const scheduleStr = c.schedule_days.toLowerCase();
        const isToday = scheduleStr.includes(currentDayName.toLowerCase()) ||
            scheduleStr.includes(currentFullDayName.toLowerCase()) ||
            (currentDayName === 'Thu' && scheduleStr.includes('thurs')) ||
            (currentDayName === 'Wed' && scheduleStr.includes('weds'));

        if (isToday) {
            classesScheduledTodayCount++;
            if (isClassActive(todayStr, c.start_time, c.end_time)) {
                currentlyActiveClassesCount++;
                activeInstructorIds.add(c.instructor_id);
            }
        }
    });
    const activeFaculty = activeInstructorIds.size;

    // Global attendance rate (7-day) - Initial fallback, will be refined after trend aggregation
    let globalAttendanceRate = 0;

    // ─── 14-DAY TREND & 30-DAY BREAKDOWN ────────────────────────────────
    // 🔃 SYNC today to Manila for chart slotting
    const today = new Date();
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = subDays(today, 13 - i);
        return { dateObj: d, date: formatInManila(d, 'MMM dd'), present: 0, late: 0, absent: 0 };
    });

    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(today, 29 - i);
        return {
            dateObj: d,
            dateStr: formatInManila(d, 'yyyy-MM-dd'),
            dayName: formatInManila(d, 'EEE'),
            fullDayName: formatInManila(d, 'EEEE')
        };
    });

    type ClassStats = { className: string; id: string; present: number; late: number; absent: number; percentage?: number };
    const classStatsMap = new Map<string, ClassStats>();

    // Pre-initialize class stats with 0s for all department classes
    instructorClasses?.forEach((cls: InstructorClass) => {
        classStatsMap.set(cls.id, { className: cls.name, id: cls.id, present: 0, late: 0, absent: 0 });
    });

    // Pre-collect physical logs for later processing (after dayOverrides are fetched)
    const allRelevantLogs = (breakdownLogs as unknown as DashboardAttendanceLog[]) || [];


    // 2. We need enrollment counts per class for synthetic calculation
    const enrollmentCounts = new Map<string, number>();
    (enrolledData as unknown as { classes?: { id: string } | { id: string }[] | null; class_id: string }[] | null)?.forEach((e) => {
        const clsObj = Array.isArray(e.classes) ? e.classes[0] : e.classes;
        const cid = clsObj?.id || e.class_id;
        if (cid) {
            enrollmentCounts.set(cid, (enrollmentCounts.get(cid) || 0) + 1);
        }
    });

    // Build a set of overridden keys so we can skip physical logs on suspended days
    const overriddenKeys = new Set<string>();
    (dayOverrides as { class_id: string; date: string; type: string }[] || []).forEach(o => {
        if (['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)) {
            overriddenKeys.add(`${o.date}:${o.class_id}`);
        }
    });

    // 1. Process Physical Logs with proper deduplication (Priority: Late > Present > Absent)
    const logsByDayAndClass = new Map<string, Set<string>>(); // "dateStr:classId" -> Set of studentIds
    const bestStatusByStudent = new Map<string, string>();

    allRelevantLogs.forEach((log) => {
        const dStr = toManilaDateString(log.timestamp);
        const clsObj = Array.isArray(log.classes) ? log.classes[0] : log.classes;
        const classId = log.class_id || clsObj?.id;
        if (!classId || !log.student_id) return;

        // Skip logs on overridden (suspended/cancelled/holiday) days
        if (overriddenKeys.has(`${dStr}:${classId}`)) return;

        const studentKey = `${dStr}:${classId}:${log.student_id}`;
        const eff = getEffectiveStatus(log);

        const existing = bestStatusByStudent.get(studentKey);
        if (!existing) {
            bestStatusByStudent.set(studentKey, eff);
        } else {
            if (eff === 'Late') {
                bestStatusByStudent.set(studentKey, 'Late');
            } else if (eff === 'Present' && existing === 'Absent') {
                bestStatusByStudent.set(studentKey, 'Present');
            }
        }
    });

    // Now populate stats from deduplicated logs
    bestStatusByStudent.forEach((eff, studentKey) => {
        const [dStr, classId, studentId] = studentKey.split(':');

        // Track unique logs per student/class/day for synthetic exclusion
        const key = `${dStr}:${classId}`;
        if (!logsByDayAndClass.has(key)) logsByDayAndClass.set(key, new Set());
        logsByDayAndClass.get(key)!.add(studentId);

        // Add to class stats
        const stats = classStatsMap.get(classId);
        if (stats) {
            if (eff === 'Present') stats.present++;
            else if (eff === 'Late') stats.late++;
            else if (eff === 'Absent' || eff === 'Left Early' || eff === 'Cut Class') stats.absent++;
        }

        // Add to 14-day trend stats
        const trendStat = last14Days.find(d => toManilaDateString(d.dateObj) === dStr);
        if (trendStat) {
            if (eff === 'Present') trendStat.present++;
            else if (eff === 'Late') trendStat.late++;
            else if (eff === 'Absent' || eff === 'Left Early' || eff === 'Cut Class') trendStat.absent++;
        }
    });

    // 4. THE BIG LOOP: Unified synthetic absence recovery
    (instructorClasses as unknown as InstructorClass[])?.forEach((cls: InstructorClass) => {
        const scheduleDays = cls.schedule_days || "";
        const classCreatedAt = new Date(cls.created_at);
        const enrolmentCount = enrollmentCounts.get(cls.id) || 0;
        if (enrolmentCount === 0) return;

        last30Days.forEach(dayInfo => {
            if (dayInfo.dateObj < classCreatedAt) return;

            const scheduleStr = scheduleDays.toLowerCase();
            const wasScheduled = scheduleStr.includes(dayInfo.dayName.toLowerCase()) ||
                scheduleStr.includes(dayInfo.fullDayName.toLowerCase()) ||
                (dayInfo.dayName === 'Thu' && scheduleStr.includes('thurs')) ||
                (dayInfo.dayName === 'Wed' && scheduleStr.includes('weds'));
            if (!wasScheduled) return;

            const isToday = dayInfo.dateStr === todayStr;
            if (isToday) {
                if (cls.end_time && isClassStillOngoing(dayInfo.dateStr, cls.end_time)) return;
            }

            // Check overrides
            if (dayOverrides?.some((o: { class_id: string; date: string; type: string }) => o.class_id === cls.id && o.date === dayInfo.dateStr && ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type))) return;

            // Synthetic gap: Enrolled - TotalLogsThatDay
            const key = `${dayInfo.dateStr}:${cls.id}`;
            const logCountOnDay = logsByDayAndClass.get(key)?.size || 0;
            const missingCount = Math.max(0, enrolmentCount - logCountOnDay);

            if (missingCount > 0) {
                // Add to 30-day class breakdown
                const stats = classStatsMap.get(cls.id);
                if (stats) stats.absent += missingCount;

                // Add to 14-day trend if in range
                const dayStat = last14Days.find(d => formatInManila(d.dateObj, 'yyyy-MM-dd') === dayInfo.dateStr);
                if (dayStat) dayStat.absent += missingCount;
            }
        });
    });

    const trendData = last14Days.map(d => ({ date: d.date, present: d.present, late: d.late, absent: d.absent }));

    // Accurate Global Attendance Rate (calculated from last 7 days of trendData)
    const last7DaysOfTrend = trendData.slice(-7);
    let totalPresentLate = 0;
    let totalLogsIn7Days = 0;
    last7DaysOfTrend.forEach(d => {
        totalPresentLate += (d.present + d.late);
        totalLogsIn7Days += (d.present + d.late + d.absent);
    });
    globalAttendanceRate = totalLogsIn7Days > 0 ? Math.round((totalPresentLate / totalLogsIn7Days) * 100) : 0;

    // Today's active count for stats card
    const todaysLogs = allRelevantLogs.filter((l) => l.timestamp >= todayStartStr);
    let activeTodayCount = 0;
    todaysLogs.forEach((l) => {
        const eff = getEffectiveStatus(l);
        if (eff === 'Present' || eff === 'Late') activeTodayCount++;
    });

    // ─── INSTRUCTOR PERFORMANCE (admin filtered out) ─────────────────────
    interface InstructorPerf {
        id: string;
        name: string;
        image_url?: string | null;
        classCount: number;
        studentCount: number;
        attendanceRate: number;
        totalLogs: number;
    }

    const instructorPerfMap = new Map<string, InstructorPerf>();

    // Initialize with only actual instructors (no admin)
    actualInstructors.forEach((inst) => {
        instructorPerfMap.set(inst.id, {
            id: inst.id,
            name: inst.name || 'Unknown',
            image_url: inst.image_url,
            classCount: 0,
            studentCount: 0,
            attendanceRate: 0,
            totalLogs: 0,
        });
    });

    // Count classes per instructor
    (instructorClasses as unknown as InstructorClass[])?.forEach((c) => {
        const perf = instructorPerfMap.get(c.instructor_id);
        if (perf) perf.classCount++;
    });

    // FIX #5: Count unique students per instructor (via enrollments + created students)
    const instructorStudentSets = new Map<string, Set<string>>();
    // Add enrolled students
    (enrolledData as unknown as { classes: { instructor_id: string }; student_id: string }[])?.forEach((e) => {
        const classes = Array.isArray(e.classes) ? e.classes[0] : e.classes;
        const instId = classes?.instructor_id;
        if (instId && instructorPerfMap.has(instId)) {
            if (!instructorStudentSets.has(instId)) instructorStudentSets.set(instId, new Set());
            instructorStudentSets.get(instId)!.add(e.student_id);
        }
    });
    // Add created-by students (captures unenrolled students)
    (createdIds as unknown as { instructor_id: string; id: string }[])?.forEach((s) => {
        const instId = s.instructor_id;
        if (instId && instructorPerfMap.has(instId)) {
            if (!instructorStudentSets.has(instId)) instructorStudentSets.set(instId, new Set());
            instructorStudentSets.get(instId)!.add(s.id);
        }
    });

    instructorStudentSets.forEach((students, instId) => {
        const perf = instructorPerfMap.get(instId);
        if (perf) perf.studentCount = students.size;
    });

    // Attendance rate per instructor (7-day)
    const instructorAttendance = new Map<string, { present: number; total: number }>();
    (recentAttendance as unknown as DashboardAttendanceLog[])?.forEach((log) => {
        const clsObj = Array.isArray(log.classes) ? log.classes[0] : log.classes;
        const instId = clsObj?.instructor_id;
        if (!instId || !instructorPerfMap.has(instId)) return;
        if (!instructorAttendance.has(instId)) instructorAttendance.set(instId, { present: 0, total: 0 });
        const stats = instructorAttendance.get(instId)!;
        stats.total++;
        const eff = getEffectiveStatus(log);
        if (eff === 'Present' || eff === 'Late') stats.present++;
    });

    instructorAttendance.forEach((stats, instId) => {
        const perf = instructorPerfMap.get(instId);
        if (perf) {
            perf.attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
            perf.totalLogs = stats.total;
        }
    });

    const instructorPerformance = Array.from(instructorPerfMap.values())
        .sort((a, b) => b.attendanceRate - a.attendanceRate);

    // ─── RENDER ──────────────────────────────────────────────────────────

    const getRateColor = (rate: number) => {
        if (rate >= 90) return "text-emerald-600 dark:text-emerald-400";
        if (rate >= 75) return "text-amber-600 dark:text-amber-400";
        return "text-red-600 dark:text-red-400";
    };

    return (
        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Department-wide metrics and oversight</p>
                </div>
                <div className="flex space-x-3">
                    {/* FIX #7: Export CSV — uses interactive modal button */}
                    <AddClassDialog
                        trigger={
                            <button className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-xl hover:bg-red-700 transition-all shadow-sm text-sm font-medium">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Class
                            </button>
                        }
                    />
                    <Link
                        href="/dashboard/admin/instructors"
                        className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium"
                    >
                        Manage Faculty
                    </Link>
                </div>
            </div>

            {/* ─── STAT CARDS ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Total Dept. Enrollment */}
                <Link href="/students" className="group">
                    <div className="bg-nwu-red rounded-3xl p-4 text-white relative overflow-hidden shadow-sm transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgb(142,13,14,0.3)] h-full">
                        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                            <GraduationCap className="h-32 w-32" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-white/80">Total Dept. Enrollment</p>
                                <div className="p-2 bg-white/20 rounded-full">
                                    <GraduationCap className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="text-4xl font-bold mb-1">{totalEnrollment.toLocaleString()}</h2>
                            <p className="text-white/60 text-xs">Students enrolled across dept.</p>
                        </div>
                    </div>
                </Link>

                {/* Faculty Status (admin excluded) */}
                <Link href="/dashboard/admin/instructors" className="group">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Faculty Status</p>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                    <span className="text-emerald-600 dark:text-emerald-400">{activeFaculty}</span>
                                    <span className="text-lg text-gray-400 font-normal"> / {totalFaculty}</span>
                                </h2>
                            </div>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-600 dark:text-emerald-400">
                                <Users className="h-5 w-5" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Instructors currently teaching</p>
                    </div>
                </Link>

                {/* Global Attendance Rate */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(16,185,129,0.15)] dark:hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)]">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Attendance Rate</p>
                            <h2 className={`text-3xl font-bold mt-1 ${getRateColor(globalAttendanceRate)}`}>
                                {globalAttendanceRate}%
                            </h2>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                        <span>Last 7 days</span>
                        <span className="text-gray-300">•</span>
                        <span>{activeTodayCount} present today</span>
                    </div>
                </div>

                {/* Active Classes */}
                <Link href="/classes" className="group">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgb(245,158,11,0.15)] dark:hover:shadow-[0_8px_30px_rgb(245,158,11,0.1)] h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Active Classes</p>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                    <span className="text-amber-600 dark:text-amber-400">{currentlyActiveClassesCount}</span>
                                    <span className="text-lg text-gray-400 font-normal"> / {classesScheduledTodayCount}</span>
                                </h2>
                            </div>
                            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-full text-amber-600 dark:text-amber-400">
                                <BookOpen className="h-5 w-5" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Currently ongoing vs today&apos;s total</p>
                    </div>
                </Link>
            </div>

            {/* ─── ROW 2: CHART + INSTRUCTOR OVERVIEW ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                <div className="lg:col-span-2 h-full">
                    {/* FIX #9: Renamed chart title for admin */}
                    <AttendanceChart
                        data={trendData}
                        title="Department Attendance Analytics"
                        subtitle="Combined attendance trend across all instructors in the department (last 14 days)"
                    />
                </div>

                {/* Instructor Performance Overview (admin filtered out) */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)]">
                    <div className="flex justify-between items-center mb-5">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Faculty Overview</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Classes and student load per instructor</p>
                        </div>
                    </div>

                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[340px] pr-1">
                        {instructorPerformance.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
                                <p className="text-sm">No faculty data available</p>
                            </div>
                        ) : (
                            instructorPerformance.map((inst) => (
                                // FIX #2: Arrow links to instructor's classes
                                <Link
                                    key={inst.id}
                                    href={`/classes?instructor=${inst.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {inst.image_url ? (
                                            <div className="relative h-9 w-9 flex-shrink-0">
                                                <Image
                                                    src={inst.image_url}
                                                    alt={inst.name || "Instructor"}
                                                    fill
                                                    className="rounded-full object-cover shadow-sm border border-gray-100 dark:border-gray-700"
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-nwu-red to-red-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                                                {inst.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {inst.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2 text-gray-400">
                                        <div className="flex flex-col items-end mr-1">
                                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                                {inst.classCount} class{inst.classCount !== 1 ? 'es' : ''}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                                {inst.studentCount} student{inst.studentCount !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 group-hover:text-nwu-red group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ─── ROW 3: ROOM CONTROLS + KIOSK HEALTH + IOT ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Room Controls - Priority for Dept Admin */}
                <div className="lg:col-span-3">
                    <AdminRoomControl title="Department Room Controls" />
                </div>

                {/* IoT Infrastructure - Only for Super Admin (2/3 width) */}
                {isSuperAdmin ? (
                    <>
                        <div className="lg:col-span-2">
                            <IoTStatusMonitor />
                        </div>
                        {/* Kiosk Health - Right Aligned with Faculty Overview (1/3 width) */}
                        <div className="lg:col-span-1 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] rounded-3xl h-full">
                            <KioskHealthCard />
                        </div>
                    </>
                ) : (
                    /* If not super admin, stretch Kiosk Health to match the whole dashboard width (aligns with both ends) */
                    <div className="lg:col-span-3 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] rounded-3xl">
                        <KioskHealthCard />
                    </div>
                )}
            </div>
        </>
    );
}
