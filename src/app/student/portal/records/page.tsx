"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession, getLatestStudentRecord } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Loader2, AlertTriangle, Activity, TrendingUp, CheckCircle2, Clock, XCircle, FileQuestion, ChevronDown } from "lucide-react";

// Types for Attendance Data
interface ClassStat {
    id: number;
    subject_name: string;
    section: string;
    year_level: string;
    present: number;
    late: number;
    absent: number;
    excuse_pending: number;
    total: number;
    percentage: number;
}

interface OverallStat {
    total: number;
    present: number;
    late: number;
    absent: number;
    absent_total?: number; // Added optional fields for compatibility if needed
    excuse_pending: number;
    percentage: number;
}

interface AcademicTerm {
    id: string;
    name: string;
    is_active: boolean;
    academic_years: { name: string } | null;
}

function StudentAttendance({ sin }: { sin: string }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ overall: OverallStat | null, classes: ClassStat[] }>({ overall: null, classes: [] });
    const [error, setError] = useState<string | null>(null);
    const [terms, setTerms] = useState<AcademicTerm[]>([]);
    const [selectedTermId, setSelectedTermId] = useState<string>("");

    // Fetch Terms
    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const res = await fetch('/api/academic-terms');
                if (res.ok) {
                    const data = await res.json();
                    setTerms(data);
                    const active = data.find((t: AcademicTerm) => t.is_active);
                    if (active) setSelectedTermId(active.id);
                }
            } catch (err) {
                console.error("Error fetching terms:", err);
            }
        };
        fetchTerms();
    }, []);

    // Fetch Attendance based on SIN and selectedTermId
    useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const url = new URL('/api/student/attendance', window.location.origin);
                url.searchParams.append('sin', sin);
                if (selectedTermId) url.searchParams.append('termId', selectedTermId);

                const res = await fetch(url.toString(), { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load attendance");

                setStats({ overall: data.overall_stats, classes: data.class_stats });
                setError(null);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("Unknown error occurred");
                }
            } finally {
                setLoading(false);
            }
        };

        if (sin) fetchAttendance();
    }, [sin, selectedTermId]);

    const activeTerm = terms.find(t => t.id === selectedTermId);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Term Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 px-1">Selected Period</p>
                    <div className="relative group min-w-[240px]">
                        <select
                            value={selectedTermId}
                            onChange={(e) => setSelectedTermId(e.target.value)}
                            className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer focus:ring-2 focus:ring-nwu-red/20 transition-all"
                        >
                            {terms.map(term => (
                                <option key={term.id} value={term.id}>
                                    {term.academic_years?.name} - {term.name} {term.is_active ? '(Active)' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                    </div>
                </div>

                {activeTerm && (
                    <div className="hidden md:block text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${activeTerm.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {activeTerm.is_active ? 'Currently Active' : 'Historical Data'}
                        </span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 space-y-4">
                    <Loader2 className="h-10 w-10 text-nwu-red animate-spin" />
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest animate-pulse">Synchronizing Data...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
                    <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold mb-1">Could not load attendance</h3>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Overall Stats Card */}
                    {stats.overall && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-100/50 dark:shadow-none relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-5 text-gray-400">
                                <TrendingUp className="h-48 w-48" />
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                                <div className="relative h-40 w-40 flex items-center justify-center">
                                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                        <circle cx="80" cy="80" r="70" className="stroke-current text-gray-100 dark:text-gray-800" strokeWidth="12" fill="none" />
                                        <circle
                                            cx="80" cy="80" r="70"
                                            className={`stroke-current ${stats.overall.percentage >= 80 ? 'text-green-500' : stats.overall.percentage >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
                                            strokeWidth="12"
                                            fill="none"
                                            strokeDasharray="439.8"
                                            strokeDashoffset={439.8 - (439.8 * stats.overall.percentage) / 100}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="text-center">
                                        <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{stats.overall.percentage}%</span>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Average</p>
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle2 className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Present</span>
                                        </div>
                                        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.overall.present}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-yellow-600">
                                            <Clock className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Late</span>
                                        </div>
                                        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.overall.late}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-red-600">
                                            <XCircle className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Absent</span>
                                        </div>
                                        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.overall.absent}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <FileQuestion className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Excused</span>
                                        </div>
                                        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.overall.excuse_pending}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Per Class Breakdown */}
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            Subject Breakdown
                        </h2>

                        {stats.classes.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium tracking-tight">No attendance records found for this period.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {stats.classes.map(cls => (
                                    <div key={cls.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-lg transition-all hover:shadow-2xl hover:scale-[1.01]">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight uppercase tracking-tight">{cls.subject_name}</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 uppercase tracking-widest">{cls.section} • {cls.year_level}</p>
                                            </div>
                                            <div className={`px-4 py-2 rounded-2xl text-sm font-black shadow-sm ${cls.percentage >= 80 ? 'bg-green-50 text-green-700' : cls.percentage >= 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                                                {cls.percentage}%
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="text-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-lg font-black text-green-600">{cls.present}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Present</p>
                                            </div>
                                            <div className="text-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-lg font-black text-yellow-600">{cls.late}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Late</p>
                                            </div>
                                            <div className="text-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-lg font-black text-red-600">{cls.absent}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Absent</p>
                                            </div>
                                            <div className="text-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-lg font-black text-blue-600">{cls.excuse_pending}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Excused</p>
                                            </div>
                                        </div>

                                        <div className="mt-6 flex items-center gap-3">
                                            <div className="h-2 flex-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${cls.percentage >= 80 ? 'bg-green-500' : cls.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${cls.percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cls.total} Total</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

interface Student {
    name: string;
    sin: string;
    image_url?: string;
    status?: string;
}

export default function RecordsPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const session = await getStudentSession();
            if (!session) {
                router.push("/student/portal");
                return;
            }
            // Sync live status
            const latest = await getLatestStudentRecord();
            if (latest.student) {
                setStudent(latest.student);
            } else {
                setStudent(session);
            }
            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading || !student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
            </div>
        );
    }

    return (
        <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url} status={student.status?.toUpperCase()}>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Activity className="h-8 w-8 text-nwu-red" />
                        Attendance Records
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Real-time tracking of your classroom attendance and performance.
                    </p>
                </div>

                <StudentAttendance sin={student.sin} />
            </div>
        </StudentLayout>
    );
}
