"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession, getStudentNotifications, getLatestStudentRecord, markNotificationAsRead } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import {
    Calendar,
    ShieldCheck,
    ArrowRight,
    Activity,
    Clock,
    FileText,
    QrCode,
    AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { NewMessageModal } from "@/components/student/NewMessageModal";
import { AbsenceWarningModal } from "@/components/student/AbsenceWarningModal";

interface Student {
    id: string;
    name: string;
    sin: string;
    year_level?: string;
    image_url?: string;
    status?: string;
}

interface Term {
    id: string;
    name: string;
    is_active: boolean;
}

interface Notification {
    id: string;
    type: 'no_class' | 'low_attendance' | 'info' | 'message';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
}

interface Stats {
    total: number;
    present: number;
    late: number;
    absent: number;
    excuse_pending: number;
    percentage: number;
}

// No unused ClassStat interface

interface AcademicData {
    term: Term | null;
    academic_year: string;
    overrides: OverrideOverride[];
}

interface OverrideOverride {
    class_id: string;
    date: string;
    type: string;
    note: string | null;
    classes: { name: string } | null;
}

export default function DashboardPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [absenceAlerts, setAbsenceAlerts] = useState<{ className: string; instructorName: string; absentCount: number }[]>([]);
    const [academicData, setAcademicData] = useState<AcademicData>({ term: null, academic_year: "N/A", overrides: [] });
    const [activeTerm, setActiveTerm] = useState<Term | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showAbsenceModal, setShowAbsenceModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const session = await getStudentSession();
            if (!session) {
                router.push("/student/portal");
                return;
            }

            try {
                // ⚡ PARALLEL: Fetch everything using PROVEN working endpoints
                const [statsRes, notifyResData, latestStudentRes, termsRes, overridesRes] = await Promise.all([
                    fetch(`/api/student/attendance?sin=${session.sin}`),
                    getStudentNotifications(),
                    getLatestStudentRecord(),
                    fetch('/api/academic-terms'),  // Same proven endpoint as Records page
                    fetch(`/api/student/academic-info?studentId=${session.id}`)  // Only for overrides
                ]);

                // 1. Sync Student Base Data
                if (latestStudentRes.student) {
                    setStudent(latestStudentRes.student);
                } else {
                    setStudent(session);
                }

                // 2. Sync Academic Info from PROVEN /api/academic-terms
                const allTerms = await termsRes.json();
                let foundActiveTerm: Term | null = null;
                let foundAcademicYear = "N/A";

                if (Array.isArray(allTerms)) {
                    const active = allTerms.find((t: Record<string, unknown>) => t.is_active);
                    if (active) {
                        foundActiveTerm = { id: active.id, name: active.name, is_active: active.is_active };
                        const ay = active.academic_years as { name: string } | null;
                        foundAcademicYear = ay?.name || "N/A";
                    }
                }

                setActiveTerm(foundActiveTerm);

                // 3. Get overrides for modal from academic-info API
                let todayOverrides: OverrideOverride[] = [];
                try {
                    const overridesData = await overridesRes.json();
                    console.log('[Dashboard Debug] Override API response:', JSON.stringify(overridesData, null, 2));
                    todayOverrides = overridesData?.overrides || [];
                } catch (overrideErr) {
                    console.error('[Dashboard Debug] Override fetch failed:', overrideErr);
                }

                setAcademicData({
                    term: foundActiveTerm,
                    academic_year: foundAcademicYear,
                    overrides: todayOverrides
                });

                // 4. Sync Attendance Stats
                const statsData = await statsRes.json();
                setStats(statsData.overall_stats);
                const classStatsList = statsData.class_stats || [];

                // 5. Notifications & Modals Logic
                const dbNotifications = notifyResData.notifications || [];
                const unreadDb = dbNotifications.filter((n: Notification) => !n.read && (n.type === 'message' || n.type === 'no_class'));

                // Virtual Notifications from Overrides (Today's suspensions/holidays)
                const virtualNotifications: Notification[] = todayOverrides
                    .map((o: OverrideOverride) => ({
                        id: `override-${o.class_id}-${o.date}`,
                        type: 'no_class' as const,
                        title: `${(o.type || 'Announcement').toUpperCase()}: ${o.classes?.name || 'Class'}`,
                        message: o.note || `Please be advised that classes for ${o.classes?.name || 'this subject'} are ${o.type} today, ${o.date}.`,
                        created_at: new Date().toISOString(),
                        read: !!sessionStorage.getItem(`ack_override-${o.class_id}-${o.date}`)
                    }))
                    .filter((n: Notification) => !n.read);

                // ✅ Deduplicate by title & Filter out past cancellations
                const todayStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Asia/Manila' }).format(new Date());
                const allRaw = [...virtualNotifications, ...unreadDb];
                const seen = new Set<string>();
                const finalNotifications: Notification[] = [];

                for (const n of allRaw) {
                    if (!seen.has(n.title)) {
                        // For 'no_class', extra safety: if the message contains a date, it must be today
                        if (n.type === 'no_class') {
                            const dateMatch = n.message.match(/\d{4}-\d{2}-\d{2}/);
                            if (dateMatch && dateMatch[0] !== todayStr) continue;
                        }

                        seen.add(n.title);
                        finalNotifications.push(n);
                    }
                }
                setNotifications(finalNotifications);

                // 6. Absence Warning Modal (5+ total absences)
                const totalAbsent = statsData.overall_stats?.absent || 0;
                const computedAlertsForModal: { className: string; instructorName: string; absentCount: number }[] = [];

                if (totalAbsent >= 5) {
                    const lastAckCount = parseInt(localStorage.getItem(`ack_absences_${session.id}`) || "0");
                    if (totalAbsent > lastAckCount) {
                        for (const stat of classStatsList) {
                            if (stat.absent > 0) {
                                computedAlertsForModal.push({
                                    className: stat.subject_name || "Unknown Class",
                                    instructorName: stat.instructor_name || "Unknown Instructor",
                                    absentCount: stat.absent,
                                });
                            }
                        }
                        if (computedAlertsForModal.length === 0) {
                            computedAlertsForModal.push({
                                className: "Overall Attendance",
                                instructorName: "System Administrator",
                                absentCount: totalAbsent,
                            });
                        }
                        setAbsenceAlerts(computedAlertsForModal);
                    }
                }

                // 7. Trigger Priority Modals
                if (finalNotifications.length > 0) {
                    setShowModal(true);
                } else if (computedAlertsForModal.length > 0) {
                    setShowAbsenceModal(true);
                }

            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            }

            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading || !student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
            </div>
        );
    }

    const QUICK_LINKS = [
        {
            name: "QR Scanner",
            description: "Scan attendance QR code",
            href: "/student/portal/scanner",
            icon: QrCode,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
        },
        {
            name: "Attendance Records",
            description: "View your attendance history",
            href: "/student/portal/records",
            icon: Activity,
            color: "text-green-600",
            bg: "bg-green-50 dark:bg-green-900/20"
        },
        {
            name: "Excuse Letter",
            description: "Submit justification for absence",
            href: "/student/portal/excuse",
            icon: FileText,
            color: "text-orange-600",
            bg: "bg-orange-50 dark:bg-orange-900/20"
        },
    ];

    return (
        <StudentLayout
            studentName={student.name}
            sin={student.sin}
            imageUrl={student.image_url}
            status={student.status?.toUpperCase()}
        >
            {showModal && (
                <NewMessageModal
                    notifications={notifications}
                    onClose={() => {
                        // Mark notifications as acknowledged
                        notifications.forEach(n => {
                            if (n.id.startsWith('override-')) {
                                sessionStorage.setItem(`ack_${n.id}`, 'true');
                            } else {
                                // Real DB notification
                                markNotificationAsRead(n.id);
                            }
                        });
                        setShowModal(false);
                        if (absenceAlerts.length > 0) {
                            setShowAbsenceModal(true);
                        }
                    }}
                />
            )}
            {showAbsenceModal && (
                <AbsenceWarningModal
                    alerts={absenceAlerts}
                    onClose={() => {
                        setShowAbsenceModal(false);
                        if (stats) {
                            localStorage.setItem(`ack_absences_${student.id}`, stats.absent.toString());
                        }
                    }}
                />
            )}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="h-20 w-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden shadow-red-100/50 dark:shadow-none shrink-0 relative">
                            {student.image_url ? (
                                <Image
                                    src={student.image_url}
                                    alt={student.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-nwu-red text-2xl font-black">
                                    {student.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                Dashboard
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">
                                Welcome back, <span className="text-nwu-red font-bold">{student.name.split(' ')[0]}</span>!
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm self-start md:self-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {activeTerm?.name || (student ? "No Active Semester" : "Loading Semester...")}
                        </span>
                    </div>
                </div>

                {/* Status Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-100/50 dark:shadow-none transition-all hover:scale-[1.02]">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                <ShieldCheck className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</p>
                                <p className={`text-lg font-black ${student.status?.toLowerCase() === 'enrolled' || student.status?.toLowerCase() === 'active' ? 'text-green-600 dark:text-green-400' :
                                    student.status?.toLowerCase() === 'graduated' ? 'text-blue-600 dark:text-blue-400' :
                                        'text-red-600 dark:text-red-400'
                                    }`}>
                                    {(student.status || "Enrolled").toUpperCase()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full w-fit">
                            <ShieldCheck className="h-3 w-3" />
                            LIVE STATUS SYNCED
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-100/50 dark:shadow-none transition-all hover:scale-[1.02]">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <Clock className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Year Level</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">
                                    {(student.status?.toLowerCase() === 'dropped' && student.year_level === 'CURRENT')
                                        ? "4th Year" // Manual check for current user or session fallback
                                        : (student.year_level || "Loading...")}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full w-fit uppercase tracking-tighter">
                            <Activity className="h-3 w-3" />
                            Academic Year {academicData.academic_year}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-100/50 dark:shadow-none transition-all hover:scale-[1.02]">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-nwu-red" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">
                                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full w-fit">
                            <Clock className="h-3 w-3" />
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-widest text-xs opacity-50">
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {QUICK_LINKS.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="group bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-lg hover:shadow-2xl transition-all duration-300 relative overflow-hidden"
                            >
                                <div className="relative z-10 flex flex-col gap-4">
                                    <div className={`h-14 w-14 rounded-2xl ${link.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                                        <link.icon className={`h-7 w-7 ${link.color}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{link.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{link.description}</p>
                                    </div>
                                    <div className="flex items-center text-xs font-bold text-nwu-red mt-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                        ACCESS NOW <ArrowRight className="h-3 w-3 ml-1" />
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <link.icon className="h-24 w-24" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Low Attendance Warning - MOVED TO BOTTOM */}
                {stats && stats.absent >= 1 && (
                    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-6 shadow-xl animate-in slide-in-from-right duration-700">
                        <div className="h-16 w-16 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg shrink-0">
                            <AlertTriangle className="h-8 w-8 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Low Attendance Warning</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                You have accumulated <span className="font-black text-orange-600 dark:text-orange-400 underline decoration-2 underline-offset-4">{stats.absent} absences</span>. Please coordinate with your instructors to avoid potential failure due to absences.
                            </p>
                        </div>
                        <Link
                            href="/student/portal/records"
                            className="w-full md:w-auto px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all text-center"
                        >
                            Review Records
                        </Link>
                    </div>
                )}

                {/* Security Update - RESTORED STYLE */}
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                        <ShieldCheck className="h-40 w-40" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-900/10">
                                <ShieldCheck className="h-7 w-7 text-nwu-red" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Security Update</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    We&apos;ve introduced password-protected logins. If this is your first time, your default password is your SIN.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/student/portal/settings"
                            className="text-nwu-red font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all underline decoration-2 underline-offset-8"
                        >
                            Update Security Settings <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                {/* System Messages */}
                {student.status && ['graduated', 'dropped', 'transferred'].includes(student.status.toLowerCase()) && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl p-8 flex items-center gap-6">
                        <div className="h-16 w-16 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg shrink-0">
                            <ShieldCheck className="h-8 w-8 text-nwu-red" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Account Status Restricted</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                Your current status is set to <span className="font-bold uppercase text-nwu-red">{student.status}</span>.
                                Some portal features like QR scanning and excuse letters are disabled. Please contact the registrar if this is an error.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </StudentLayout>
    );
}
