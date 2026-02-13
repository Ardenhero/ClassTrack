import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { format, differenceInMinutes } from "date-fns";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";
import { AttendanceFilter } from "./AttendanceFilter";
import { cookies } from "next/headers";
import { getProfileRole } from "@/lib/auth-utils";
import LiveAttendanceTable from "@/components/LiveAttendanceTable";
import type { AttendanceRow } from "@/components/LiveAttendanceTable";

interface AttendanceLog {
    id: string;
    timestamp: string;
    status: string;
    time_out: string | null;
    classes: {
        name: string;
        instructor_id: string;
        start_time: string | null;
        end_time: string | null;
    } | null;
    students: {
        id: string;
        name: string;
        year_level: string;
        sin: string;
    };
}

export default async function AttendancePage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
        date?: string;
    };
}) {
    const query = searchParams?.query || "";
    const dateParam = searchParams?.date;
    const supabase = createClient();
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;

    // Date Logic (Manila Timezone Safe)
    const getManilaDate = () => {
        return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    };

    let targetDate: Date;
    if (dateParam) {
        targetDate = new Date(dateParam);
    } else {
        targetDate = getManilaDate();
    }

    const dayString = format(targetDate, 'yyyy-MM-dd');
    const todayManilaStr = format(getManilaDate(), 'yyyy-MM-dd');
    const isToday = dayString === todayManilaStr;
    const displayDate = isToday ? null : format(targetDate, 'MMMM d, yyyy');

    const startOfTargetDay = new Date(`${dayString}T00:00:00+08:00`).toISOString();
    const endOfTargetDay = new Date(`${dayString}T23:59:59+08:00`).toISOString();

    let queryBuilder = supabase
        .from('attendance_logs')
        .select(`
      id,
      status,
      timestamp,
      time_out,
      entry_method,
      classes!inner (
        name,
        instructor_id,
        start_time,
        end_time
      ),
      students!inner (
        id,
        name,
        sin,
        year_level
      )
    `)
        .gte('timestamp', startOfTargetDay)
        .lte('timestamp', endOfTargetDay)
        .order('timestamp', { ascending: false });

    const role = await getProfileRole();
    const isActiveAdmin = role === 'admin';

    if (!isActiveAdmin && profileId) {
        queryBuilder = queryBuilder.eq('classes.instructor_id', profileId);
    }

    if (query) {
        queryBuilder = queryBuilder.ilike('students.name', `%${query}%`);
    }

    const { data } = await queryBuilder;
    const rawLogs = data as unknown as AttendanceLog[];

    /* ── Map server data → serialisable AttendanceRow[] ── */
    const formatTime = (ts: string | null) => {
        if (!ts) return "-";
        return new Date(ts).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
    };

    const attendanceRows: AttendanceRow[] = (rawLogs || []).map(log => {
        const student = log.students;
        const cls = log.classes;

        const firstLog = new Date(log.timestamp);
        let statusLabel = log.status || 'Present';
        let badgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        let iconName = "CheckCircle";

        let isInvalidSession = false;
        if (cls?.start_time && statusLabel !== 'Excused') {
            const classStartString = `${dayString}T${cls.start_time}`;
            const classStart = new Date(`${classStartString}+08:00`);
            const validSessionStart = new Date(classStart.getTime() - 20 * 60000);
            if (firstLog < validSessionStart) isInvalidSession = true;
        }

        if (isInvalidSession) {
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
            }
        }

        if (!log.timestamp && log.time_out) {
            statusLabel = "Incomplete / Absent";
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
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full md:w-auto">
                    <div className="w-full md:w-48">
                        <AttendanceFilter />
                    </div>
                    <div className="w-full md:w-80">
                        <Suspense fallback={<div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />}>
                            <GlobalSearch type="students" placeholder="Search student name..." />
                        </Suspense>
                    </div>
                </div>
            </div>

            <LiveAttendanceTable initialRows={attendanceRows} dayString={dayString} />
        </DashboardLayout>
    );
}
