import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { ArrowLeft, Clock, AlertCircle, CheckCircle, Ghost, TimerOff, TrendingUp, CalendarOff, Activity, Calendar } from "lucide-react";
import Link from "next/link";
import { format, parse, differenceInMinutes } from "date-fns";
import { AttendanceFilter } from "@/app/attendance/AttendanceFilter";
import { cookies } from "next/headers";
import EnrolledStudentsList from "./EnrolledStudentsList";
import { History as HistoryIcon } from "lucide-react";
import { getProfile, checkIsSuperAdmin } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
// import { Skeleton } from "@/components/ui/Skeleton";

const AssignStudentDialog = nextDynamic(() => import("../AssignStudentDialog").then(m => m.AssignStudentDialog), { ssr: false });
const ExportCSVButton = nextDynamic(() => import("./ExportCSVButton").then(m => m.ExportCSVButton), { ssr: false });
const ExportFullReportButton = nextDynamic(() => import("./ExportFullReportButton").then(m => m.ExportFullReportButton), { ssr: false });
const MarkNoClassButton = nextDynamic(() => import("./MarkNoClassButton").then(m => m.default), { ssr: false });

export const dynamic = "force-dynamic";

interface Enrollment {
    id: string;
    students: {
        id: string;
        name: string;
        year_level: string;
        fingerprint_id: number;
        image_url: string | null;
    }
}

export default async function ClassDetailsPage({ params, searchParams }: { params: { id: string }, searchParams?: { date?: string } }) {
    const supabase = createClient();
    const dateParam = searchParams?.date;

    // Determine if viewer is an instructor (for override buttons)
    const cookieStore = cookies();
    const viewerProfileId = cookieStore.get("sc_profile_id")?.value;
    let isInstructor = false;

    // Date Logic matching Attendance Page (Manila Timezone Safe)
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
    const dayName = format(targetDate, 'EEE'); // 'Mon', 'Tue'
    const fullDayName = format(targetDate, 'EEEE'); // 'Monday'
    const todayManilaStr = format(getManilaDate(), 'yyyy-MM-dd');
    const isToday = dayString === todayManilaStr;
    const displayDate = isToday ? "Today's Attendance" : `Attendance for ${format(targetDate, 'MMMM d, yyyy')}`;

    // Query boundaries for the selected day in Manila
    const targetStart = new Date(`${dayString}T00:00:00+08:00`).toISOString();
    const targetEnd = new Date(`${dayString}T23:59:59+08:00`).toISOString();

    // ⚡ BATCH 1: Fire class data, viewer profile, enrollments, and day override in parallel
    const [classResult, viewerResult, enrollmentResult, dayOverrideResult] = await Promise.all([
        supabase.from("classes").select("*, academic_terms(is_active)").eq("id", params.id).single(),
        viewerProfileId
            ? supabase.from("instructors").select("role").eq("id", viewerProfileId).single()
            : Promise.resolve({ data: null }),
        supabase.from("enrollments").select(`*, students (*)`).eq("class_id", params.id).order("id"),
        supabase.from("class_day_overrides").select("id, type, note").eq("class_id", params.id).eq("date", dayString).maybeSingle(),
    ]);

    const classData = classResult.data as (typeof classResult.data & { academic_terms: { is_active: boolean } | null; instructors: { department_id: string } | null });
    if (!classData) {
        return <div>Class not found</div>;
    }

    // --- DEPARTMENT ISOLATION CHECK ---
    const profile = await getProfile();
    const isSuperAdmin = await checkIsSuperAdmin();
    if (profile?.role === 'admin' && !isSuperAdmin) {
        // Fetch class instructor's department to compare
        const { data: classInstructor } = await supabase
            .from('instructors')
            .select('department_id')
            .eq('id', classData.instructor_id)
            .single();
        
        if (classInstructor && classInstructor.department_id !== profile.department_id) {
            redirect("/attendance?error=unauthorized_department");
        }
    }

    const isTermActive = classData.academic_terms?.is_active ?? true;
    const isReadOnly = !isTermActive;

    const viewerProfile = viewerResult.data;
    if (viewerProfile && viewerProfileId) {
        const viewerRole = (viewerProfile as { role: string }).role;
        isInstructor = (viewerRole === "instructor" || viewerRole === "admin") && classData.instructor_id === viewerProfileId && !isReadOnly;
    }

    const enrollments = enrollmentResult.data as unknown as Enrollment[];
    const dayOverride = dayOverrideResult.data || null;
    const isHoliday = !!dayOverride;

    // ⚡ BATCH 2: Fire today's logs + all-time logs in parallel (need studentIds from Batch 1)
    const studentIds = enrollments?.map(e => e.students.id) || [];
    const [logsResult, allTimeLogsResult] = await Promise.all([
        supabase
            .from("attendance_logs")
            .select("student_id, timestamp, time_out, status")
            .in("student_id", studentIds)
            .eq("class_id", params.id)
            .gte("timestamp", targetStart)
            .lte("timestamp", targetEnd)
            .order("timestamp", { ascending: true }),
        supabase
            .from("attendance_logs")
            .select("student_id, status") // Reduced selection for all-time stats (history)
            .in("student_id", studentIds)
            .eq("class_id", params.id),
    ]);

    const logs = logsResult.data;
    const allTimeLogs = allTimeLogsResult.data;

    // Compute per-student all-time stats
    const allTimeStats: Record<string, { sessions: number; present: number; late: number; absent: number; excused: number }> = {};
    studentIds.forEach(id => {
        allTimeStats[id] = { sessions: 0, present: 0, late: 0, absent: 0, excused: 0 };
    });

    const nowManila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

    allTimeLogs?.forEach(log => {
        const stats = allTimeStats[log.student_id];
        if (stats) {
            const s = log.status || 'Present';
            // Do not count suspended/holiday classes towards total holding sessions or absences
            if (s !== 'holiday' && s !== 'suspended' && s !== 'cancelled' && s !== 'No Class' && s !== 'Holiday' && s !== 'Suspended') {
                stats.sessions++;
                if (s === 'Present' || s === 'Manually Verified') stats.present++;
                else if (s === 'Late') stats.late++;
                else if (s === 'Excused') stats.excused++;
                else stats.absent++;
            }
        }
    });

    // Handle today's specifics from detailed logs (Batch 2, query 1)
    logs?.forEach(log => {
        const stats = allTimeStats[log.student_id];
        if (stats && classData.end_time) {
            const s = log.status || 'Present';
            // Sync status resolution: Missed timeout = Absent (only for today's detailed logs)
            if ((s === 'Present' || s === 'Late') && !log.time_out) {
                const logDate = format(new Date(log.timestamp), 'yyyy-MM-dd');
                const classEndTime = new Date(`${logDate}T${classData.end_time}+08:00`);
                const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000); // 30 min grace
                if (nowManila > gracePeriodEnd) {
                    // Update stats (already counted as present/late in the loop above)
                    if (s === 'Present' || s === 'Manually Verified') stats.present--;
                    else if (s === 'Late') stats.late--;
                    stats.absent++;
                }
            }
        }
    });

    // Helper to calculate status visuals
    const getStatusVisuals = (studentId: string) => {
        const studentLogs = logs?.filter(l => l.student_id === studentId) || [];
        const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

        // 1. Check for Holiday/Suspension Override
        if (isHoliday) {
            const hasLog = studentLogs.length > 0;
            const session = hasLog ? studentLogs[studentLogs.length - 1] : null;
            return {
                statusLabel: 'No Class',
                badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                icon: AlertCircle,
                timeIn: session ? formatTime(new Date(session.timestamp)) : '-',
                timeOut: (session && session.time_out) ? formatTime(new Date(session.time_out)) : '-',
            };
        }

        // 2. Check Class Schedule (If not today, show No Class)
        const schedule = classData.schedule_days?.toLowerCase() || "";
        const isScheduledDay = schedule.includes(dayName.toLowerCase()) ||
            schedule.includes(fullDayName.toLowerCase()) ||
            (dayName === 'Thu' && schedule.includes('thurs')) ||
            (dayName === 'Wed' && schedule.includes('weds'));

        if (!isScheduledDay) {
            return {
                statusLabel: 'No Class (Not Scheduled)',
                badgeColor: 'bg-amber-50 text-amber-600 dark:bg-amber-900/10 dark:text-amber-500',
                icon: CalendarOff,
                timeIn: '-',
                timeOut: '-',
            };
        }


        if (studentLogs.length === 0) {
            // DYNAMIC ABSENCE LOGIC (30-min buffer)
            const isWaitPeriod = () => {
                if (!classData.end_time || !isToday) return false;
                const classEndTime = new Date(`${dayString}T${classData.end_time}+08:00`);
                const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000); // 30 min buffer
                return nowManila < gracePeriodEnd;
            };

            const isFuture = () => {
                if (!classData.start_time || !isToday) return false;
                const classStartTime = new Date(`${dayString}T${classData.start_time}+08:00`);
                return nowManila < classStartTime;
            };

            if (isFuture()) {
                return {
                    statusLabel: 'Yet to Start',
                    badgeColor: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                    icon: Clock,
                    timeIn: '-',
                    timeOut: '-'
                };
            }

            if (isWaitPeriod() || isToday) {
                // If it's today, we don't call them "Absent" yet until the day or session is fully wrapped
                const classEndTime = classData.end_time ? new Date(`${dayString}T${classData.end_time}+08:00`) : null;
                const isStillTime = classEndTime ? nowManila < new Date(classEndTime.getTime() + 30 * 60000) : true;

                if (isStillTime) {
                    return {
                        statusLabel: 'Scanning...',
                        badgeColor: 'bg-blue-50 text-blue-500 animate-pulse dark:bg-blue-900/20 dark:text-blue-400',
                        icon: Activity,
                        timeIn: '-',
                        timeOut: '-'
                    };
                }
            }

            return {
                statusLabel: 'Absent (No Record)',
                badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                icon: AlertCircle,
                timeIn: '-',
                timeOut: '-'
            };
        }

        // Take the latest session
        const session = studentLogs[studentLogs.length - 1];
        const firstLog = new Date(session.timestamp); // Time In

        // STRICT SESSION WINDOW LOGIC
        let isInvalidSession = false;
        // Skip check if explicitly Excused
        if (classData.start_time && session.status !== 'Excused') {
            const classStartString = `${dayString}T${classData.start_time}`;
            const classStart = new Date(`${classStartString}+08:00`); // Manila Time
            const validSessionStart = new Date(classStart.getTime() - 20 * 60000); // 20 mins before

            if (firstLog < validSessionStart) {
                isInvalidSession = true;
            }
        }

        // Format times

        const timeIn = formatTime(firstLog);
        const timeOut = session.time_out ? formatTime(new Date(session.time_out)) : "-";

        if (isInvalidSession) {
            return {
                statusLabel: 'Invalid (Too Early)',
                badgeColor: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500', // Gray for invalid
                icon: AlertCircle, // Use a generic alert or maybe a specific "Not Started" icon if available
                timeIn: timeIn,
                timeOut: timeOut // Show timeOut even if invalid
            };
        }

        // Logic based on DB Status + Timestamps for special icons
        const dbStatus = session.status || 'Present'; // Default to Present if null

        // Check if class is fully over and they forgot to time out
        let missedTimeOut = false;
        if (classData.end_time && !session.time_out && dbStatus !== 'Excused' && dbStatus !== 'Absent') {
            const classEndString = `${dayString}T${classData.end_time}`;
            const classEnd = new Date(`${classEndString}+08:00`);

            // Allow a 15 min grace period for tapping out
            const gracePeriodEnd = new Date(classEnd.getTime() + 15 * 60000);
            const now = new Date();

            if (now > gracePeriodEnd) {
                // Class is fully over and no time out recorded
                missedTimeOut = true;
            }
        }

        let statusLabel = dbStatus;
        let badgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        let icon = CheckCircle;

        if (statusLabel === 'holiday' || statusLabel === 'suspended' || statusLabel === 'cancelled' || statusLabel === 'No Class' || statusLabel === 'Suspended' || statusLabel === 'Holiday') {
            statusLabel = 'No Class';
            badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            icon = AlertCircle;
        } else if (dbStatus === 'Present') {
            badgeColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            icon = CheckCircle;
        } else if (dbStatus === 'Late') {
            badgeColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            icon = Clock;
        } else if (dbStatus === 'Excused') {
            badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            icon = CheckCircle;
        } else if (dbStatus === 'Absent') {
            badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            icon = AlertCircle;

            // Check for special "Absent" reasons if Class End Time is known
            // ONLY check if the session was valid to begin with (which it is if we are here)
            if (classData.end_time && session.time_out) {
                const classEndString = `${dayString}T${classData.end_time}`;
                const classEnd = new Date(`${classEndString}+08:00`); // Manila Time
                const logOutTime = new Date(session.time_out);
                // Note: session.time_out is ISO/UTC, so new Date() works correctly for comparison
                // But we need to compare apples to apples in minutes

                const diffMinutes = differenceInMinutes(logOutTime, classEnd);

                if (diffMinutes < -15) {
                    // Cutting Class (>15 mins early)
                    statusLabel = "Cut Class"; // Custom label for UI clarity
                    icon = TimerOff; // "Runner" icon substitute
                } else if (diffMinutes > 60) {
                    // Ghosting (>60 mins late)
                    statusLabel = "Ghosting"; // Custom label
                    icon = Ghost;
                }
            }
        }

        if (missedTimeOut && statusLabel !== 'No Class') {
            statusLabel = "Absent (No Timeout)";
            badgeColor = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            icon = AlertCircle;
        }

        return {
            statusLabel,
            badgeColor,
            icon,
            timeIn: statusLabel === 'No Class' ? '-' : timeIn,
            timeOut: statusLabel === 'No Class' ? '-' : timeOut
        };
    };

    // Calculate Summary Stats
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let absentCount = 0;
    let noClassCount = 0;

    enrollments?.forEach(e => {
        const { statusLabel } = getStatusVisuals(e.students.id);
        if (statusLabel.includes('No Class')) noClassCount++;
        else if (statusLabel === 'Present') presentCount++;
        else if (statusLabel === 'Late') lateCount++;
        else if (statusLabel === 'Excused') excusedCount++;
        else if (statusLabel === 'Incomplete / Absent') absentCount++;
        else if (statusLabel === 'Absent' || statusLabel === 'Cut Class' || statusLabel === 'Ghosting') absentCount++;
        else if (statusLabel === 'Invalid (Too Early)') {
            // Do nothing
        }
        else absentCount++; // Includes 'Absent', 'Cut Class', 'Ghosting'
    });

    return (
        <DashboardLayout>
            <div className="mb-8">
                <Link href="/classes" className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Classes
                </Link>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                {classData.name}
                            </h1>
                            {isReadOnly && (
                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800/30 flex items-center gap-1.5 self-center mt-1">
                                    <HistoryIcon className="h-3.5 w-3.5" />
                                    Archived Records
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{classData.description}</p>

                        {classData.schedule_days && (
                            <div className="flex items-center mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <Calendar className="h-4 w-4 mr-1.5 text-nwu-red dark:text-nwu-red-light" />
                                {classData.schedule_days.split(",").map((d: string) => ({ "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday" } as Record<string, string>)[d.trim()] || d).join(", ")}
                            </div>
                        )}
                        {classData.start_time && (
                            <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400 pl-0.5">
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                {format(parse(classData.start_time, 'HH:mm:ss', new Date()), 'h:mm a')} - {classData.end_time ? format(parse(classData.end_time, 'HH:mm:ss', new Date()), 'h:mm a') : ''}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            {isInstructor && <AssignStudentDialog classId={params.id} className={classData.name} instructorId={classData.instructor_id} />}
                            {isInstructor && (
                                <MarkNoClassButton
                                    classId={params.id}
                                    className={classData.name}
                                    date={dayString}
                                    instructorId={viewerProfileId || ''}
                                    existingOverride={dayOverride}
                                />
                            )}
                            <ExportCSVButton
                                className_={classData.name}
                                date={dayString}
                                students={enrollments?.map(e => {
                                    const vis = getStatusVisuals(e.students.id);
                                    return {
                                        name: e.students.name,
                                        year_level: e.students.year_level,
                                        status: vis.statusLabel,
                                        timeIn: vis.timeIn,
                                        timeOut: vis.timeOut,
                                    };
                                }) || []}
                            />
                            <ExportFullReportButton
                                className_={classData.name}
                                students={enrollments?.map(e => {
                                    const stats = allTimeStats[e.students.id] || { sessions: 0, present: 0, late: 0, absent: 0, excused: 0 };
                                    const rate = stats.sessions > 0 ? ((stats.present + stats.late) / stats.sessions) * 100 : 0;
                                    return {
                                        name: e.students.name,
                                        year_level: e.students.year_level,
                                        totalSessions: stats.sessions,
                                        presentCount: stats.present,
                                        lateCount: stats.late,
                                        absentCount: stats.absent,
                                        excusedCount: stats.excused,
                                        attendanceRate: rate,
                                    };
                                }) || []}
                            />
                        </div>
                        <div className="mt-2">
                            <AttendanceFilter />
                        </div>
                    </div>
                </div>

                {/* Holiday Banner */}
                {isHoliday && (
                    <div className="flex items-center gap-3 p-4 mt-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
                        <CalendarOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                            <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                                No Class — {dayOverride?.type === 'holiday' ? 'Holiday' : dayOverride?.type === 'cancelled' ? 'Cancelled' : dayOverride?.type === 'suspended' ? 'Suspended' : dayOverride?.type}
                            </p>
                            {dayOverride?.note && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{dayOverride.note}</p>}
                            <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">This day is excluded from attendance calculations and absence notifications.</p>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
                    {isHoliday ? (
                        <div className="col-span-2 sm:col-span-5 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
                            <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">No Class Today</div>
                            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{noClassCount} students — not counted</div>
                        </div>
                    ) : (
                        <>
                            <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-200/50 dark:hover:shadow-green-900/30 cursor-default">
                                <div className="text-xs text-green-600 dark:text-green-400 font-medium">Present</div>
                                <div className="text-xl font-bold text-green-700 dark:text-green-300">{presentCount}</div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-200/50 dark:hover:shadow-orange-900/30 cursor-default">
                                <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">Late</div>
                                <div className="text-xl font-bold text-orange-700 dark:text-orange-300">{lateCount}</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-200/50 dark:hover:shadow-blue-900/30 cursor-default">
                                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Excused</div>
                                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{excusedCount}</div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-200/50 dark:hover:shadow-red-900/30 cursor-default">
                                <div className="text-xs text-red-600 dark:text-red-400 font-medium">Absent</div>
                                <div className="text-xl font-bold text-red-700 dark:text-red-300">{absentCount}</div>
                            </div>
                        </>
                    )}
                    {enrollments && enrollments.length > 0 && (() => {
                        const totalSessions = Object.values(allTimeStats).reduce((s, v) => s + v.sessions, 0);
                        const totalPresent = Object.values(allTimeStats).reduce((s, v) => s + v.present + v.late, 0);
                        const avgRate = totalSessions > 0 ? ((totalPresent / totalSessions) * 100).toFixed(0) : '0';
                        return (
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-200/50 dark:hover:shadow-indigo-900/30 cursor-default">
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Class Avg</div>
                                <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{avgRate}%</div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            <EnrolledStudentsList
                students={enrollments?.map(e => {
                    const { statusLabel, badgeColor, icon: Icon, timeIn, timeOut } = getStatusVisuals(e.students.id);
                    const stats = allTimeStats[e.students.id] || { sessions: 0, present: 0, late: 0, absent: 0, excused: 0 };
                    const rate = stats.sessions > 0 ? ((stats.present + stats.late) / stats.sessions) * 100 : 0;
                    return {
                        enrollmentId: e.id,
                        studentId: e.students.id,
                        studentName: e.students.name,
                        yearLevel: e.students.year_level,
                        statusLabel,
                        badgeColor,
                        iconName: Icon.displayName || 'CheckCircle',
                        timeIn,
                        timeOut,
                        studentImageUrl: e.students.image_url,
                        allTimeSessions: stats.sessions,
                        allTimePresent: stats.present,
                        allTimeLate: stats.late,
                        allTimeAbsent: stats.absent,
                        allTimeExcused: stats.excused,
                        attendanceRate: rate,
                    };
                }) || []}
                classId={params.id}
                dayString={dayString}
                displayDate={displayDate}
                isInstructor={isInstructor}
            />
        </DashboardLayout>
    );
}
