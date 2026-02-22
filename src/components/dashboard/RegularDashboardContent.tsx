import { createClient } from "@/utils/supabase/server";
import { Users, UserCheck, Clock, Plus, Calendar, BookOpen, MoreHorizontal, ArrowRight } from "lucide-react";
import Link from "next/link";
import { format, subDays, startOfDay } from "date-fns";
import { AttendanceChart } from "@/components/AttendanceChart";
import { IoTSwitches } from "@/components/IoTSwitches";
import { AddStudentDialog } from "@/app/students/AddStudentDialog";
import { AddClassDialog } from "@/app/classes/AddClassDialog";
import { markAttendance } from "@/app/actions";

export default async function RegularDashboardContent({
    profileId,
    isActiveAdmin,
    accountInstructorIds,
    query
}: {
    profileId: string;
    isActiveAdmin: boolean;
    accountInstructorIds: string[];
    query: string;
}) {
    const supabase = createClient();
    const getManilaDate = (date: Date = new Date()) => {
        return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    };

    const nowManila = getManilaDate();
    const todayManilaStr = format(nowManila, 'yyyy-MM-dd');

    // 1. Fetch Summary Stats
    // Students
    let studentCount = 0;

    if (isActiveAdmin) {
        if (accountInstructorIds.length > 0) {
            const { data: createdIds } = await supabase.from('students').select('id').in('instructor_id', accountInstructorIds);
            const { data: enrolledIds } = await supabase.from('enrollments').select('student_id, classes!inner(instructor_id)').in('classes.instructor_id', accountInstructorIds);

            const uniqueIds = new Set([
                ...(createdIds?.map(s => s.id) || []),
                ...(enrolledIds?.map(e => e.student_id) || [])
            ]);
            studentCount = uniqueIds.size;
        }
    } else if (profileId) {
        const uniqueStudentIds = new Set<string>();
        const { data: createdStudents } = await supabase.from('students').select('id').eq('instructor_id', profileId);
        createdStudents?.forEach(s => uniqueStudentIds.add(s.id));

        const { data: enrolledData } = await supabase.from('enrollments').select('student_id, classes!inner(instructor_id)').eq('classes.instructor_id', profileId);
        enrolledData?.forEach(e => uniqueStudentIds.add(e.student_id));

        studentCount = uniqueStudentIds.size;
    }

    // Classes
    let classQuery = supabase.from('classes').select('*', { count: 'exact', head: true });
    if (isActiveAdmin) {
        if (accountInstructorIds.length > 0) {
            classQuery = classQuery.in('instructor_id', accountInstructorIds);
        } else {
            classQuery = classQuery.eq('instructor_id', '00000000-0000-0000-0000-000000000000');
        }
    } else if (profileId) {
        classQuery = classQuery.eq('instructor_id', profileId);
    }
    const { count: classCount } = await classQuery;

    // 2. Fetch Weekly Logs
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(today, 6 - i);
        return {
            date: d,
            day: format(d, 'EEE'),
            label: format(d, 'MMM dd'),
            count: 0
        };
    });

    const weekStart = startOfDay(last7Days[0].date).toISOString();

    let weekLogsQuery = supabase
        .from('attendance_logs')
        .select('timestamp, status, classes!inner(instructor_id)')
        .eq('status', 'Present')
        .gte('timestamp', weekStart);

    if (isActiveAdmin && accountInstructorIds.length > 0) {
        weekLogsQuery = weekLogsQuery.in('classes.instructor_id', accountInstructorIds);
    } else if (!isActiveAdmin && profileId) {
        weekLogsQuery = weekLogsQuery.eq('classes.instructor_id', profileId);
    }

    const { data: weekLogs } = await weekLogsQuery;

    weekLogs?.forEach(log => {
        const logDate = new Date(log.timestamp).toDateString();
        const dayStat = last7Days.find(d => d.date.toDateString() === logDate);
        if (dayStat) {
            dayStat.count++;
        }
    });

    // 3. Today's stats
    const todayStartStr = startOfDay(nowManila).toISOString();
    const todaysLogs = weekLogs?.filter(l => l.timestamp >= todayStartStr) || [];
    const presentCount = todaysLogs.length;

    let lateQuery = supabase
        .from('attendance_logs')
        .select('*, classes!inner(instructor_id)', { count: 'exact', head: true })
        .eq('status', 'Late')
        .gte('timestamp', todayStartStr);

    if (isActiveAdmin && accountInstructorIds.length > 0) {
        lateQuery = lateQuery.in('classes.instructor_id', accountInstructorIds);
    } else if (!isActiveAdmin && profileId) {
        lateQuery = lateQuery.eq('classes.instructor_id', profileId);
    }

    const { count: lateCount } = await lateQuery;

    // 4. Fetch Recent Students
    const fiveDaysAgo = subDays(today, 5).toISOString();
    let recentStudentQuery = supabase.from('students')
        .select('*')
        .gte('created_at', fiveDaysAgo)
        .limit(5)
        .order('created_at', { ascending: false });

    if (isActiveAdmin && accountInstructorIds.length > 0) {
        recentStudentQuery = recentStudentQuery.in('instructor_id', accountInstructorIds);
    } else if (!isActiveAdmin && profileId) {
        recentStudentQuery = recentStudentQuery.eq('instructor_id', profileId);
    }

    if (query) {
        recentStudentQuery = recentStudentQuery.ilike('name', `%${query}%`);
    }
    const { data: recentStudents } = await recentStudentQuery;

    // 5. Fetch Classes
    let classesListQuery = supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (isActiveAdmin && accountInstructorIds.length > 0) {
        classesListQuery = classesListQuery.in('instructor_id', accountInstructorIds);
    } else if (!isActiveAdmin && profileId) {
        classesListQuery = classesListQuery.eq('instructor_id', profileId);
    }

    const { data: classes } = await classesListQuery;

    const upcomingClasses = classes?.map(c => {
        if (!c.start_time || !c.end_time) return null;

        const startString = `${todayManilaStr}T${c.start_time}`;
        const start = new Date(startString);

        const attendanceOpen = new Date(start.getTime() - 15 * 60 * 1000);
        const attendanceClose = new Date(start.getTime() + 30 * 60 * 1000);

        let status = 'hidden';
        const timeDiffMs = start.getTime() - nowManila.getTime();
        const oneHourMs = 60 * 60 * 1000;

        if (nowManila >= attendanceOpen && nowManila <= attendanceClose) {
            status = 'live';
        } else if (nowManila < attendanceOpen && timeDiffMs <= oneHourMs) {
            status = 'upcoming';
        } else if (nowManila > attendanceClose) {
            status = 'completed';
        }

        if (status === 'hidden' || status === 'completed') return null;

        return { ...c, status, startTimeObj: start };
    }).filter(Boolean)
        .sort((a, b) => ((a as { startTimeObj: Date }).startTimeObj.getTime() || 0) - ((b as { startTimeObj: Date }).startTimeObj.getTime() || 0)) || [];

    const activeOrNextClass = upcomingClasses[0];

    return (
        <>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your classes and student attendance</p>
                </div>
                <div className="flex space-x-3">
                    <AddClassDialog
                        trigger={
                            <button className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm text-sm font-medium">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Class
                            </button>
                        }
                    />
                    <Link href="/students" className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium">
                        Manage Students
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-nwu-red rounded-3xl p-6 text-white relative overflow-hidden shadow-lg transform hover:scale-[1.02] transition-transform">
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
                        <h2 className="text-4xl font-bold mb-2">{classCount || 0}</h2>
                        <div className="inline-flex items-center px-2 py-1 bg-white/20 rounded-lg text-xs font-medium">
                            <span className="mr-1">↑</span> Active this semester
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
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

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
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

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
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
                    <AttendanceChart
                        data={last7Days.map(d => ({ day: d.day, count: d.count, date: d.label }))}
                    />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Upcoming Class</h3>
                        <Link href="/classes">
                            <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="h-5 w-5" /></button>
                        </Link>
                    </div>

                    <div className="space-y-4 flex-1">
                        {activeOrNextClass ? (
                            <div className={`p-4 rounded-2xl border ${activeOrNextClass.status === 'live' ? 'bg-nwu-red/5 border-nwu-red/20' : 'bg-gray-50 dark:bg-gray-700 border-gray-100 dark:border-gray-600'}`} data-testid="upcoming-class">
                                <div className="flex items-start">
                                    <div className={`p-2 rounded-lg shadow-sm mr-3 ${activeOrNextClass.status === 'live' ? 'bg-nwu-red text-white' : 'bg-white dark:bg-gray-600 text-nwu-red'}`}>
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{activeOrNextClass.name}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            <span data-testid="upcoming-class-time">{activeOrNextClass.startTimeObj ? format(activeOrNextClass.startTimeObj, 'h:mm a') : 'TBD'}</span>
                                            {' - '}
                                            {activeOrNextClass.end_time ? format(new Date(`${todayManilaStr}T${activeOrNextClass.end_time}`), 'h:mm a') : 'TBD'}
                                        </p>
                                        {activeOrNextClass.status === 'live' && (
                                            <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full animate-pulse">
                                                LIVE NOW
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Link href={`/classes/${activeOrNextClass.id}`} className="block w-full mt-4">
                                    <button className={`w-full py-2.5 rounded-xl text-xs font-medium transition-colors ${activeOrNextClass.status === 'live'
                                        ? 'bg-nwu-red text-white hover:bg-red-700'
                                        : 'bg-gray-900 dark:bg-gray-900 text-white hover:bg-gray-800'
                                        }`}>
                                        {activeOrNextClass.status === 'live' ? 'View Live Class' : 'Prepare Class'}
                                    </button>
                                </Link>

                                {activeOrNextClass.status === 'live' && (
                                    <form action={async () => {
                                        "use server";
                                        await markAttendance(activeOrNextClass.id);
                                    }} className="mt-2">
                                        <button className="w-full py-2.5 rounded-xl text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">
                                            Mark Attendance
                                        </button>
                                    </form>
                                )}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600" data-testid="upcoming-class">
                                <p className="text-sm">No classes scheduled.</p>
                            </div>
                        )}
                        <div className="pt-2 space-y-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tasks</p>
                            <div className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer group">
                                <div className="h-2 w-2 rounded-full bg-orange-400 mr-3 group-hover:scale-125 transition-transform"></div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Check hardware status</p>
                                    <p className="text-xs text-gray-400">Daily Check</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">New Students</h3>
                        <Link href="/students">
                            <button className="px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center group">
                                View All
                                <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {recentStudents?.map((student: any) => (
                            <div key={student.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 bg-nwu-red/10 rounded-full flex items-center justify-center text-nwu-red font-bold text-sm mr-4">
                                        {student.name[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{student.name}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 text-left">{student.year_level}</p>
                                    </div>
                                </div>
                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    Active
                                </div>
                            </div>
                        ))}
                        {(!recentStudents || recentStudents.length === 0) && (
                            <div className="text-center py-8">
                                <p className="text-gray-500 text-sm">No recent students {query ? "matching search" : "found"}.</p>
                                <AddStudentDialog
                                    trigger={
                                        <button className="text-nwu-red text-xs font-medium hover:underline mt-1 inline-block">
                                            Add your first student
                                        </button>
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>

                <IoTSwitches />
            </div>
        </>
    );
}
