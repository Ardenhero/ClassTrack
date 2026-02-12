import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { ArrowLeft, UserMinus, Users, Clock, AlertCircle, CheckCircle, Ghost, TimerOff } from "lucide-react";
import Link from "next/link";
import { AssignStudentDialog } from "../AssignStudentDialog";
import { removeStudent } from "./actions";
import { format, parse, differenceInMinutes } from "date-fns";
import { AttendanceFilter } from "@/app/attendance/AttendanceFilter";
import { cookies } from "next/headers";
import StatusOverrideButton from "./StatusOverrideButton";

interface Enrollment {
    id: string;
    students: {
        id: string;
        name: string;
        year_level: string;
        fingerprint_id: number;
    }
}

export default async function ClassDetailsPage({ params, searchParams }: { params: { id: string }, searchParams?: { date?: string } }) {
    const supabase = createClient();
    const dateParam = searchParams?.date;

    // Determine if viewer is an instructor (for override buttons)
    const cookieStore = cookies();
    const viewerProfileId = cookieStore.get("sc_profile_id")?.value;
    let isInstructor = false;

    if (viewerProfileId) {
        const { data: viewerProfile } = await supabase
            .from("instructors")
            .select("role")
            .eq("id", viewerProfileId)
            .single();

        // STRICTLY Instructors only (as per latest user request)
        if (viewerProfile) {
            isInstructor = viewerProfile.role === "instructor";
        }
    }

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
    const todayManilaStr = format(getManilaDate(), 'yyyy-MM-dd');
    const isToday = dayString === todayManilaStr;
    const displayDate = isToday ? "Today's Attendance" : `Attendance for ${format(targetDate, 'MMMM d, yyyy')}`;

    // Query boundaries for the selected day in Manila
    const targetStart = new Date(`${dayString}T00:00:00+08:00`).toISOString();
    const targetEnd = new Date(`${dayString}T23:59:59+08:00`).toISOString();

    // Fetch class details
    const { data: classData } = await supabase
        .from("classes")
        .select("*")
        .eq("id", params.id)
        .single();

    if (!classData) {
        return <div>Class not found</div>;
    }

    // Fetch enrolled students
    const { data } = await supabase
        .from("enrollments")
        .select(`
        *,
        students (*)
    `)
        .eq("class_id", params.id)
        .order("id"); // Ensure enrollment order is stable

    const enrollments = data as unknown as Enrollment[];

    // Fetch attendance logs with STATUS
    const studentIds = enrollments?.map(e => e.students.id) || [];
    const { data: logs } = await supabase
        .from("attendance_logs")
        .select("student_id, timestamp, time_out, status") // Select status
        .in("student_id", studentIds)
        .eq("class_id", params.id)
        .gte("timestamp", targetStart)
        .lte("timestamp", targetEnd)
        .order("timestamp", { ascending: true });

    // Helper to calculate status visuals
    const getStatusVisuals = (studentId: string) => {
        const studentLogs = logs?.filter(l => l.student_id === studentId) || [];

        if (studentLogs.length === 0) {
            return {
                statusLabel: 'Absent',
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
        if (classData.start_time) {
            const classStartString = `${dayString}T${classData.start_time}`;
            const classStart = new Date(`${classStartString}+08:00`); // Manila Time
            const validSessionStart = new Date(classStart.getTime() - 20 * 60000); // 20 mins before

            if (firstLog < validSessionStart) {
                isInvalidSession = true;
            }
        }

        // Format times
        const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
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

        let statusLabel = dbStatus;
        let badgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        let icon = CheckCircle;

        if (dbStatus === 'Present') {
            badgeColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            icon = CheckCircle;
        } else if (dbStatus === 'Late') {
            badgeColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            icon = Clock;
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

        return { statusLabel, badgeColor, icon, timeIn, timeOut };
    };

    // Calculate Summary Stats
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    enrollments?.forEach(e => {
        const { statusLabel } = getStatusVisuals(e.students.id);
        if (statusLabel === 'Present') presentCount++;
        else if (statusLabel === 'Late') lateCount++;
        else if (statusLabel === 'Invalid (Too Early)') {
            // Do nothing (don't count as present/absent/late) or maybe count as Absent depending on policy?
            // Request says: "An 'Invalid' log should not trigger any attendance status".
            // So we treat it essentially as if they haven't arrived regarding "Present/Late" counts.
            // But usually, if they are not Present/Late, they are Absent?
            // OR do we show a separate "Invalid" count?
            // For now, let's NOT count them as Present/Late. They will fall into "Absent" bucket if we just use `else absentCount++`.
            // However, logic below was `else absentCount++`.
            // Modified to be explicit.
        }
        else absentCount++; // Includes 'Absent', 'Cut Class', 'Ghosting', and 'Invalid (Too Early)'
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
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{classData.name}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{classData.description}</p>
                        {classData.start_time && (
                            <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                                <Clock className="h-4 w-4 mr-1" />
                                {format(parse(classData.start_time, 'HH:mm:ss', new Date()), 'h:mm a')} - {classData.end_time ? format(parse(classData.end_time, 'HH:mm:ss', new Date()), 'h:mm a') : ''}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <AssignStudentDialog classId={params.id} />
                        <div className="mt-2">
                            <AttendanceFilter />
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30">
                        <div className="text-sm text-green-600 dark:text-green-400 font-medium">Present</div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">{presentCount}</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/30">
                        <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Late</div>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{lateCount}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900/30">
                        <div className="text-sm text-red-600 dark:text-red-400 font-medium">Absent</div>
                        <div className="text-2xl font-bold text-red-700 dark:text-red-300">{absentCount}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center">
                        <Users className="h-5 w-5 text-gray-400 mr-2" />
                        <h3 className="font-bold text-gray-900 dark:text-white">{displayDate}</h3>
                    </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {enrollments?.map((enrollment) => {
                        const { statusLabel, badgeColor, icon: Icon, timeIn, timeOut } = getStatusVisuals(enrollment.students.id);
                        return (
                            <div key={enrollment.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-4">
                                <div className="flex items-center min-w-0">
                                    <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold mr-4">
                                        {enrollment.students.name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{enrollment.students.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{enrollment.students.year_level}</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-6 text-sm">
                                    <div className="flex space-x-8 mr-4">
                                        <div className="text-center w-24">
                                            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Time In</span>
                                            <div className="bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded text-gray-900 dark:text-gray-100 font-mono text-sm">
                                                {timeIn}
                                            </div>
                                        </div>
                                        <div className="text-center w-24">
                                            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Time Out</span>
                                            <div className="bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded text-gray-900 dark:text-gray-100 font-mono text-sm">
                                                {timeOut}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeColor} min-w-[100px] justify-center`}>
                                        <Icon className="h-3 w-3 mr-1.5" />
                                        {statusLabel}
                                    </div>

                                    <form action={async () => {
                                        "use server";
                                        await removeStudent(params.id, enrollment.students.id);
                                    }}>
                                        <button type="submit" className="text-gray-400 hover:text-red-500 transition-colors" title="Remove Student">
                                            <UserMinus className="h-4 w-4" />
                                        </button>
                                    </form>

                                    {/* Manual Override — Instructor Only */}
                                    {isInstructor && (
                                        <StatusOverrideButton
                                            studentId={enrollment.students.id}
                                            classId={params.id}
                                            date={dayString}
                                            currentStatus={statusLabel}
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    {enrollments?.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            No students enrolled yet.
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
