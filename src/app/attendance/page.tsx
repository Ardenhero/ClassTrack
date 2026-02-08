import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { format, parseISO } from "date-fns";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Suspense } from "react";
import { AttendanceFilter } from "./AttendanceFilter";
import { cookies } from "next/headers";
import { getProfileRole } from "@/lib/auth-utils";

interface AttendanceLog {
    id: string;
    timestamp: string;
    status: string;
    time_out: string | null;
    classes: {
        name: string;
        instructor_id: string;
    } | null;
    students: {
        id: string;
        name: string;
        fingerprint_id: number;
        year_level: string;
        sin: string;
    };
}

interface DailyAttendance {
    studentId: string;
    date: string; // YYYY-MM-DD
    studentName: string;
    studentSin: string;
    yearLevel: string;
    className: string;
    timeIn: string;
    timeOut: string;
    status: string;
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
      classes!inner (
        name,
        instructor_id
      ),
      students!inner (
        id,
        name,
        fingerprint_id,
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

    const attendanceRows: DailyAttendance[] = (rawLogs || []).map(log => {
        const student = log.students;
        const cls = log.classes;

        const formatTime = (ts: string | null) => {
            if (!ts) return "-";
            const d = new Date(ts);
            return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
        };

        return {
            studentId: student.id,
            date: log.timestamp,
            studentName: student.name,
            studentSin: student.sin,
            yearLevel: student.year_level,
            className: cls?.name || "Unknown",
            timeIn: formatTime(log.timestamp),
            timeOut: formatTime(log.time_out),
            status: log.status || 'Present',
        };
    });

    attendanceRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <DashboardLayout>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Attendance Logs</h1>
                    <p className="text-gray-500">
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

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SIN</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Out</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {attendanceRows.map((row, idx) => (
                            <tr key={`${row.studentId}-${idx}`} className="hover:bg-gray-50 transition-colors" data-testid="attendance-record">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {format(parseISO(row.date), 'MMM d, yyyy')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {row.studentSin || "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-xs ring-1 ring-nwu-red/20">
                                            {row.studentName[0]}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{row.studentName}</div>
                                            <div className="text-xs text-gray-500">{row.yearLevel}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {row.className}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {row.timeIn}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                    {row.timeOut}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {(() => {
                                        const s = (row.status || "").toLowerCase();
                                        let label = "Present";
                                        let colorClass = "bg-green-100 text-green-800";

                                        if (s.includes('late')) {
                                            label = "Late";
                                            colorClass = "bg-yellow-100 text-yellow-800";
                                        } else if (s.includes('absent')) {
                                            label = "Absent";
                                            colorClass = "bg-red-100 text-red-800";
                                        }

                                        return (
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}>
                                                {label}
                                            </span>
                                        );
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {attendanceRows.length === 0 && (
                    <div className="p-12 text-center text-gray-500 empty-state">
                        No logs found
                    </div>
                )}
            </div>
        </DashboardLayout >
    );
}
