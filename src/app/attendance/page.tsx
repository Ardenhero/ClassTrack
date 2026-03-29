import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { format, differenceInMinutes } from "date-fns";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";
import { AttendanceFilter } from "./AttendanceFilter";
import { DepartmentSelector } from "./DepartmentSelector";
import DeclareSuspensionsButton from "./DeclareSuspensionsButton";

import { ExportCSVButton } from "./ExportCSVButton";
import { ExportFullReportButton } from "./ExportFullReportButton";
import { getProfile, checkIsSuperAdmin } from "@/lib/auth-utils";
import nextDynamic from "next/dynamic";
import { TableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import type { AttendanceRow } from "@/components/LiveAttendanceTable";

const LiveAttendanceTable = nextDynamic(() => import("@/components/LiveAttendanceTable"), {
    ssr: false,
    loading: () => <TableSkeleton rows={10} cols={7} />
});

export const dynamic = "force-dynamic";

interface AttendanceLog {
    id: string;
    timestamp: string;
    status: string | null;
    time_out: string | null;
    classes: {
        id: string;
        name: string;
        instructor_id: string;
        start_time: string | null;
        end_time: string | null;
        department: string | null;
    } | null;
    students: {
        id: string;
        name: string;
        year_level: string;
        sin: string;
        image_url: string | null;
        department_id: string | null;
    };
}

interface Department {
    id: string;
    name: string;
    code: string;
}

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string; q?: string; deptId?: string } }) {
    const supabase = createClient();
    const query = searchParams.q;

    // Manila-relative date logic
    const getManilaDate = () => {
        return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    };

    let targetDate: Date;
    if (searchParams.date) {
        targetDate = new Date(searchParams.date);
    } else {
        targetDate = getManilaDate();
    }

    const dayString = format(targetDate, 'yyyy-MM-dd');
    const todayManilaStr = format(getManilaDate(), 'yyyy-MM-dd');
    const isToday = dayString === todayManilaStr;
    const displayDate = isToday ? null : format(targetDate, 'MMMM d, yyyy');

    const startOfDay = `${dayString}T00:00:00+08:00`;
    const endOfDay = `${dayString}T23:59:59+08:00`;

    // Auth & Role handling
    const profile = await getProfile();
    const profileId = profile?.id;
    const isSuperAdmin = await checkIsSuperAdmin();
    const isActiveAdmin = profile?.role === 'admin';
    const deptId = searchParams.deptId;

    // Fetch departments for Super Admin
    let departments: Department[] = [];
    if (isSuperAdmin) {
        const { data: depts } = await supabase
            .from('departments')
            .select('id, name, code')
            .eq('is_active', true)
            .order('name');
        departments = depts || [];
    }

    let queryBuilder = supabase
        .from('attendance_logs')
        .select(`
            *,
            classes!inner ( id, name, instructor_id, start_time, end_time, department ),
            students!inner ( id, name, sin, year_level, image_url, department_id )
        `)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: false });

    if (query) {
        queryBuilder = queryBuilder.ilike('students.name', `%${query}%`);
    }

    // Role-based filtering logic
    let filterInstructorIds: string[] | null = null;

    if (isSuperAdmin && deptId && deptId !== 'all') {
        const { data: deptInstructors } = await supabase
            .from('instructors')
            .select('id')
            .eq('department_id', deptId);
        filterInstructorIds = (deptInstructors || []).map(i => i.id);
    } else if (!isSuperAdmin) {
        if (!isActiveAdmin && profileId) {
            filterInstructorIds = [profileId];
        } else if (isActiveAdmin && profile?.department_id) {
            const { data: deptInstructors } = await supabase
                .from('instructors')
                .select('id')
                .eq('department_id', profile.department_id);
            filterInstructorIds = (deptInstructors || []).map(i => i.id);
        }
    }

    if (filterInstructorIds) {
        queryBuilder = queryBuilder.in('classes.instructor_id', filterInstructorIds);
    }

    const { data } = await queryBuilder;
    const rawLogs = (data as unknown as AttendanceLog[]) || [];

    // --- DYNAMIC SUSPENSION / NO CLASS HANDLING ---
    // Fetch overrides for status resolution in the table, but skip synthetic log injection
    let overridesQuery = supabase.from('class_day_overrides').select('class_id, type').eq('date', dayString);
    if (filterInstructorIds) {
        const { data: myClasses } = await supabase.from('classes').select('id').in('instructor_id', filterInstructorIds);
        const myClassIds = myClasses?.map(c => c.id) || [];
        overridesQuery = overridesQuery.in('class_id', myClassIds);
    }
    const { data: overrides } = await overridesQuery;

    /* ── Map server data → serialisable AttendanceRow[] ── */
    const formatTime = (ts: string | null) => {
        if (!ts) return "-";
        return new Date(ts).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
    };

    const overrideMap = new Map(overrides?.map(o => [o.class_id, o.type]) || []);

    const attendanceRows: AttendanceRow[] = (rawLogs || []).map(log => {
        const student = log.students;
        const cls = log.classes;
        const classId = cls?.id;

        const firstLog = new Date(log.timestamp);
        let statusLabel = log.status || 'Present';

        // --- PRIORITY: Overrides (Suspensions/Holidays) ---
        if (classId && overrideMap.has(classId)) {
            statusLabel = 'No Class';
        }
        let badgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        let iconName = "CheckCircle";

        let isInvalidSession = false;
        if (cls?.start_time && statusLabel !== 'Excused' && statusLabel !== 'No Class') {
            const classStartString = `${dayString}T${cls.start_time}`;
            const classStart = new Date(`${classStartString}+08:00`);
            const validSessionStart = new Date(classStart.getTime() - 20 * 60000);
            if (firstLog < validSessionStart) isInvalidSession = true;
        }

        if (isInvalidSession && statusLabel !== 'No Class') {
            statusLabel = 'Invalid (Too Early)';
            badgeColor = 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500';
            iconName = "AlertCircle";
        } else {
            if (statusLabel === 'Present') {
                badgeColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                iconName = "CheckCircle";
            } else if (statusLabel === 'Late') {
                badgeColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
                iconName = "Clock";
            } else if (statusLabel === 'Absent') {
                badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                iconName = "AlertCircle";
                if (cls?.end_time && log.time_out) {
                    const classEnd = new Date(`${dayString}T${cls.end_time}+08:00`);
                    const logOutTime = new Date(log.time_out);
                    const diffMinutes = differenceInMinutes(logOutTime, classEnd);
                    if (diffMinutes < -15) { statusLabel = "Cut Class"; iconName = "TimerOff"; }
                    else if (diffMinutes > 60) { statusLabel = "Ghosting"; iconName = "Ghost"; }
                }
            } else if (statusLabel === 'No Class') {
                badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                iconName = "AlertCircle";
            }
        }

        let missedTimeOut = false;
        if (cls?.end_time && !log.time_out && statusLabel !== 'Excused' && statusLabel !== 'Absent') {
            const classEndString = `${dayString}T${cls.end_time}`;
            const classEnd = new Date(`${classEndString}+08:00`);
            const gracePeriodEnd = new Date(classEnd.getTime() + 15 * 60000);
            const now = new Date();
            if (now > gracePeriodEnd) missedTimeOut = true;
        }

        if (missedTimeOut && statusLabel !== 'No Class') {
            statusLabel = "Absent (No Timeout)";
            badgeColor = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            iconName = "AlertCircle";
        }

        if (!log.timestamp && log.time_out && statusLabel !== 'No Class') {
            statusLabel = "Absent (No Timeout)";
            badgeColor = "bg-red-100 text-red-800";
            iconName = "AlertCircle";
        }

        return {
            id: log.id,
            studentId: student.id,
            date: log.timestamp,
            studentName: student.name,
            studentSin: student.sin,
            yearLevel: student.year_level,
            studentImageUrl: student.image_url,
            className: cls?.name || "Unknown",
            timeIn: formatTime(log.timestamp),
            timeOut: formatTime(log.time_out),
            status: log.status || 'Present',
            statusLabel,
            badgeColor,
            iconName,
        };
    });

    attendanceRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <DashboardLayout>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Logs</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {displayDate ? (
                            <>History for <span className="font-semibold text-nwu-red">{displayDate}</span></>
                        ) : (
                            "Today's attendance"
                        )}
                    </p>
                </div>
                <div className="flex flex-col md:flex-row md:flex-wrap space-y-4 md:space-y-0 md:space-x-4 w-full md:w-auto items-center justify-end">
                    {isSuperAdmin && (
                        <>
                            <div className="w-full md:w-auto pb-4 md:pb-0">
                                <DepartmentSelector departments={departments} currentDeptId={deptId} />
                            </div>
                            <div className="w-full md:w-auto pb-4 md:pb-0">
                                <DeclareSuspensionsButton />
                            </div>
                        </>
                    )}
                    <div className="flex items-center gap-2">
                        <ExportCSVButton
                            date={dayString}
                            rows={attendanceRows}
                            departmentName={isSuperAdmin ? (deptId ? departments.find(d => d.id === deptId)?.name || "Department" : "Global") : (profile?.department_id ? "Department" : "Global")}
                        />
                        <ExportFullReportButton
                            departmentId={isSuperAdmin ? (deptId || '') : (profile?.department_id || '')}
                            departmentName={isSuperAdmin ? (deptId ? departments.find(d => d.id === deptId)?.name || "Department" : "Global") : (profile?.department_id ? "Department" : "Global")}
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <AttendanceFilter />
                    </div>
                    <div className="w-full md:w-80">
                        <Suspense fallback={<Skeleton className="h-10 w-full" variant="rounded" />}>
                            <GlobalSearch type="students" placeholder="Search student name..." />
                        </Suspense>
                    </div>
                </div>
            </div>

            <LiveAttendanceTable initialRows={attendanceRows} dayString={dayString} instructorIds={filterInstructorIds || undefined} />
        </DashboardLayout>
    );
}
