import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Clock, CalendarDays, CheckCircle2, AlertCircle, XCircle, Coffee, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getProfile, checkIsSuperAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

interface PageProps {
    params: { id: string; classId: string };
}

interface AttendanceLog {
    id: number;
    timestamp: string;
    time_out: string | null;
    status: string | null;
    student_id: number;
    class_id: string;
}

interface ClassData {
    id: string;
    name: string;
    start_time: string | null;
    end_time: string | null;
}

export default async function StudentClassAttendancePage({ params }: PageProps) {
    const cookieStore = cookies();
    const profileId = cookieStore.get("sc_profile_id")?.value;
    const adminSupabase = createAdminClient();

    if (!profileId) {
        redirect("/dashboard");
    }

    const idParam = params.id;
    const isNumeric = /^\d+$/.test(idParam);
    const studentIdInt = isNumeric ? parseInt(idParam) : null;
    const classId = params.classId;

    // Resolve Student first to get correct ID
    let studentQuery = adminSupabase.from("students").select("id, name, image_url, department_id");
    if (studentIdInt !== null) {
        studentQuery = studentQuery.or(`id.eq.${studentIdInt},sin.eq.${idParam}`);
    } else {
        studentQuery = studentQuery.eq("sin", idParam);
    }
    const { data: student } = await studentQuery.single();

    if (!student) {
        notFound();
    }

    // --- DEPARTMENT ISOLATION CHECK ---
    const profile = await getProfile();
    const isSuperAdmin = await checkIsSuperAdmin();
    if (profile?.role === 'admin' && !isSuperAdmin) {
        // Verify student belongs to the same department or their instructor does
        if (student.department_id && student.department_id !== profile.department_id) {
            redirect("/attendance?error=unauthorized_department");
        }
        // Fallback: check instructor of the class if student department_id is missing
        const { data: classInfo } = await adminSupabase
            .from('classes')
            .select('instructor_id')
            .eq('id', classId)
            .single();
        
        if (classInfo) {
            const { data: instructor } = await adminSupabase
                .from('instructors')
                .select('department_id')
                .eq('id', classInfo.instructor_id)
                .single();
            
            if (instructor && instructor.department_id !== profile.department_id) {
                redirect("/attendance?error=unauthorized_department");
            }
        }
    }

    const resolvedStudentId = student.id;

    // Fetch Class, Logs, and Enrollment in parallel
    const [classRes, logsRes, enrollmentRes] = await Promise.all([
        adminSupabase.from("classes").select("id, name, start_time, end_time, created_at, schedule_days").eq("id", classId).single(),
        adminSupabase.from("attendance_logs")
            .select("id, timestamp, time_out, status, student_id, class_id")
            .eq("student_id", resolvedStudentId)
            .eq("class_id", classId)
            .order("timestamp", { ascending: false }),
        adminSupabase.from("enrollments")
            .select("enrolled_at")
            .eq("student_id", resolvedStudentId)
            .eq("class_id", classId)
            .maybeSingle()
    ]);

    const classData = classRes.data as (ClassData & { created_at: string; schedule_days: string });
    const logs = (logsRes.data || []) as AttendanceLog[];
    const enrollment = enrollmentRes.data;

    // --- SYNTHETIC ABSENCE LOGIC (Sync with API) ---
    const manilaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    const nowManila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const todayStr = manilaFormatter.format(nowManila);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const logDatesWithActivity = new Set(logs.map(l => manilaFormatter.format(new Date(l.timestamp))));

    // Fetch overrides for this class
    const { data: dayOverrides } = await adminSupabase
        .from('class_day_overrides')
        .select('date, type')
        .eq('class_id', classId);

    const enrollmentDate = enrollment?.enrolled_at ? new Date(enrollment.enrolled_at) : (classData.created_at ? new Date(classData.created_at) : new Date('2024-01-01'));
    const classCreatedDate = classData.created_at ? new Date(classData.created_at) : new Date('2024-01-01');
    const effectiveStartDate = enrollmentDate > classCreatedDate ? enrollmentDate : classCreatedDate;
    
    const differenceInDays = (d1: Date, d2: Date) => Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    const totalDaysBack = Math.min(365, differenceInDays(nowManila, effectiveStartDate) + 1);

    interface BaseLog {
        id: string | number;
        timestamp: string;
        status: string | null;
        isSynthetic?: boolean;
        time_out?: string | null;
    }

    const syntheticLogs: BaseLog[] = [];
    for (let i = 0; i < totalDaysBack; i++) {
        const d = new Date(nowManila);
        d.setDate(d.getDate() - i);
        const dateStr = manilaFormatter.format(d);
        const dayName = dayNames[d.getDay()];

        if (d < effectiveStartDate) continue;

        // Scheduled check
        const isScheduledOnDay = classData.schedule_days?.toLowerCase().includes(dayName.toLowerCase()) ||
            (dayName === 'Thu' && classData.schedule_days?.toLowerCase().includes('thurs')) ||
            (dayName === 'Wed' && classData.schedule_days?.toLowerCase().includes('weds'));

        if (!isScheduledOnDay) continue;

        // Already has log?
        if (logDatesWithActivity.has(dateStr)) continue;

        // Today check
        if (dateStr === todayStr && classData.end_time) {
            const classEndTime = new Date(`${dateStr}T${classData.end_time}+08:00`);
            const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000);
            if (nowManila < gracePeriodEnd) continue;
        }

        // Override check
        const hasOverride = (dayOverrides || []).some(o => 
            o.date === dateStr && ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)
        );
        if (hasOverride) continue;

        // Add synthetic record
        syntheticLogs.push({
            id: `synthetic-${dateStr}`,
            timestamp: `${dateStr}T${classData.end_time || '17:00:00'}+08:00`,
            status: 'Absent',
            isSynthetic: true
        });
    }

    // Helper to resolve effective status
    const resolveStatus = (log: BaseLog) => {
        const logDateStr = manilaFormatter.format(new Date(log.timestamp));
        const override = (dayOverrides || []).find(o => 
            o.date === logDateStr && ['holiday', 'suspended', 'cancelled', 'No Class'].includes(o.type)
        );

        if (override) return override.type;
        if (log.isSynthetic) return "Absent";
        const status = log.status || "Present";
        if (status !== "Present" && status !== "Late") return status;

        if (!log.time_out && classData?.end_time) {
            const logDate = log.timestamp.split("T")[0];
            const classEndTime = new Date(`${logDate}T${classData.end_time}+08:00`);
            const gracePeriodEnd = new Date(classEndTime.getTime() + 30 * 60000);

            if (nowManila > gracePeriodEnd) {
                return "Absent";
            }
        }
        return status;
    };

    // Combine and process all logs
    const allLogs = [...logs, ...syntheticLogs].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const resolvedLogs = allLogs.map(l => ({
        ...l,
        effectiveStatus: resolveStatus(l)
    }));

    const stats = {
        present: resolvedLogs.filter(l => l.effectiveStatus.toLowerCase() === "present").length,
        late: resolvedLogs.filter(l => l.effectiveStatus.toLowerCase() === "late").length,
        absent: resolvedLogs.filter(l => l.effectiveStatus.toLowerCase() === "absent").length,
        excused: resolvedLogs.filter(l => l.effectiveStatus.toLowerCase() === "excused").length,
    };

    const totalPossible = resolvedLogs.length;
    const attendancePct = totalPossible > 0
        ? Math.round(((stats.present + stats.late) / totalPossible) * 100)
        : 0;

    const breadcrumbItems = [
        { label: "Directory", href: "/students" },
        { label: student.name, href: `/students/${resolvedStudentId}` },
        { label: classData.name }
    ];

    return (
        <DashboardLayout>
            <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
                <div className="flex items-center justify-between mb-6">
                    <Breadcrumb items={breadcrumbItems} />
                    <Link
                        href={`/students/${resolvedStudentId}`}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-nwu-red transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Profile
                    </Link>
                </div>

                {/* Header Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
                    <div className="p-8 flex flex-col md:flex-row gap-6 items-center border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="h-20 w-20 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center text-3xl font-bold text-nwu-red shadow-sm border border-gray-200 dark:border-gray-800 shrink-0 overflow-hidden relative">
                            {student.image_url ? (
                                <Image
                                    src={student.image_url}
                                    alt={student.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                student.name[0]?.toUpperCase()
                            )}
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                {classData.name}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">
                                Attendance Records for <span className="text-gray-900 dark:text-white font-bold">{student.name}</span>
                            </p>
                        </div>
                        <div className="md:ml-auto">
                            <div className="flex items-center gap-4">
                                <div className="text-center px-6 py-2 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
                                    <div className="text-2xl font-bold text-nwu-red">{attendancePct}%</div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Average</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 dark:divide-gray-700">
                        <div className="p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <div className="inline-flex p-2 bg-green-50 dark:bg-green-900/20 rounded-lg mb-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.present}</div>
                            <div className="text-xs font-bold text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">Present</div>
                        </div>
                        <div className="p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <div className="inline-flex p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-3">
                                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.late}</div>
                            <div className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider">Late</div>
                        </div>
                        <div className="p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <div className="inline-flex p-2 bg-red-50 dark:bg-red-900/20 rounded-lg mb-3">
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.absent}</div>
                            <div className="text-xs font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-wider">Absent</div>
                        </div>
                        <div className="p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <div className="inline-flex p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3">
                                <Coffee className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.excused}</div>
                            <div className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">Excused</div>
                        </div>
                    </div>
                </div>

                {/* History Table */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-nwu-red" />
                        Full Attendance History
                    </h2>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                        {resolvedLogs.length === 0 ? (
                            <div className="p-12 text-center">
                                <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No attendance records found for this class.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[10px]">Date & Time</th>
                                        <th className="px-6 py-4 text-right font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[10px]">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    {resolvedLogs.map((log) => {
                                        const date = new Date(log.timestamp);
                                        const statusColors: Record<string, string> = {
        present: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800",
        late: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800",
        absent: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800",
        excused: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800",
        "cut class": "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800",
        suspended: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-100 dark:border-purple-800",
        holiday: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800",
        cancelled: "bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-100 dark:border-gray-800",
        "no class": "bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-100 dark:border-gray-800",
    };

                                        // Format using Manila timezone
                                        const manilaFormatter = new Intl.DateTimeFormat('en-US', {
                                            timeZone: 'Asia/Manila',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        });

                                        const parts = manilaFormatter.formatToParts(date);
                                        const getPart = (type: string) => parts.find(p => p.type === type)?.value;
                                        const formattedDate = `${getPart('month')} ${getPart('day')}, ${getPart('year')}`;
                                        const formattedTime = `${getPart('hour')}:${getPart('minute')} ${getPart('dayPeriod')}`;

                                        return (
                                            <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">
                                                        {formattedDate}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                        {formattedTime}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[log.effectiveStatus.toLowerCase() as keyof typeof statusColors] || "bg-gray-100 text-gray-600"}`}>
                                                        {log.effectiveStatus}
                                                        {log.effectiveStatus !== log.status && <span className="ml-1 opacity-50 font-normal scale-90">(No Timeout)</span>}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
