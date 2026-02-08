import DashboardLayout from "@/components/DashboardLayout";
import { createClient } from "@/utils/supabase/server";
import { ArrowLeft, UserMinus, Users, Clock, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { AssignStudentDialog } from "../AssignStudentDialog";
import { removeStudent } from "./actions";
import { format, isAfter, addMinutes, parse } from "date-fns";
import { AttendanceFilter } from "@/app/attendance/AttendanceFilter"; // Import filter

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
    // Using simple ISO string construction assuming offset +08:00
    // Note: If server logic uses local time, ensuring explicit offset is safer for comparison
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
        .eq("class_id", params.id);

    const enrollments = data as unknown as Enrollment[];

    // Fetch attendance logs for selected date
    const studentIds = enrollments?.map(e => e.students.id) || [];
    const { data: logs } = await supabase
        .from("attendance_logs")
        .select("student_id, timestamp, time_out") // Select time_out
        .in("student_id", studentIds)
        .eq("class_id", params.id)
        .gte("timestamp", targetStart)
        .lte("timestamp", targetEnd)
        .order("timestamp", { ascending: true }); // Ordered to find first/last easily

    // Helper to calculate status
    const getStatus = (studentId: string) => {
        // With new Logic, each row is a session.
        // If a student has multiple sessions (rare but possible), we show the latest one.
        const studentLogs = logs?.filter(l => l.student_id === studentId) || [];

        if (studentLogs.length === 0) return { status: 'Absent', color: 'text-red-500', icon: AlertCircle, timeIn: '-', timeOut: '-' };

        // Take the latest session
        const session = studentLogs[studentLogs.length - 1];
        const firstLog = new Date(session.timestamp); // Time In

        // Helper for Timezone format for display (Manila)
        const formatTime = (d: Date) => {
            return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
        };

        const timeIn = formatTime(firstLog);

        // Use the explicit time_out column!
        const timeOut = session.time_out ? formatTime(new Date(session.time_out)) : "-";

        // Logic: Compare firstLog with Class Start Time (relative to selected date)
        let status = 'Present';
        let color = 'text-green-500';
        let icon = CheckCircle;

        if (classData.start_time) {
            // Parse class start time against "Today" (Manila Date)
            // We construct the class start timestamp for the TARGET date
            const classStartString = `${dayString}T${classData.start_time}`; // e.g. 2026-02-01T08:00:00
            // We should parse this as a Date object. 
            // Since we want to compare with `firstLog`, which is absolute, we need classStart to be absolute correct time.
            // If we treat `classStartString` as local time in Manila...
            const classStart = new Date(`${classStartString}+08:00`);

            if (isAfter(firstLog, addMinutes(classStart, 30))) {
                status = 'Absent'; // Effectively absent if very late
                color = 'text-red-500';
                icon = AlertCircle;
            } else if (isAfter(firstLog, addMinutes(classStart, 15))) {
                status = 'Late';
                color = 'text-yellow-500';
                icon = AlertCircle;
            }
        }

        return { status, color, icon, timeIn, timeOut };
    };

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
                        {/* Attendance Filter for Class */}
                        <div className="mt-2">
                            <AttendanceFilter />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center">
                        <Users className="h-5 w-5 text-gray-400 mr-2" />
                        <h3 className="font-bold text-gray-900 dark:text-white">{displayDate}</h3>
                    </div>
                    {/* <span className="text-xs text-gray-400">Time In / Time Out</span> */}
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {enrollments?.map((enrollment) => {
                        const { status, color, icon: Icon, timeIn, timeOut } = getStatus(enrollment.students.id);
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

                                    <div className={`flex items-center ${color} font-medium min-w-[80px]`}>
                                        <Icon className="h-4 w-4 mr-1.5" />
                                        {status}
                                    </div>

                                    <form action={async () => {
                                        "use server";
                                        await removeStudent(params.id, enrollment.students.id);
                                    }}>
                                        <button type="submit" className="text-gray-400 hover:text-red-500 transition-colors" title="Remove Student">
                                            <UserMinus className="h-4 w-4" />
                                        </button>
                                    </form>
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
