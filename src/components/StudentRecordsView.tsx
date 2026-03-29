"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Activity, CheckCircle2, Clock, XCircle, HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

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
    excuse_pending: number;
    percentage: number;
}

interface Term {
    id: string;
    name: string;
    is_active: boolean;
    academic_years?: {
        name: string;
    };
}

export function StudentRecordsView({ 
    sin, 
    studentId, 
    viewerRole, 
    instructorId,
    isStudentPortal = false 
}: { 
    sin: string, 
    studentId: string, 
    viewerRole?: string, 
    instructorId?: string,
    isStudentPortal?: boolean
}) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ overall: OverallStat | null, classes: ClassStat[] }>({ overall: null, classes: [] });
    const [error, setError] = useState<string | null>(null);
    const [terms, setTerms] = useState<Term[]>([]);
    const [selectedTermId, setSelectedTermId] = useState<string>("");

    useEffect(() => {
        const fetchTerms = async () => {
            const res = await fetch('/api/academic-terms');
            if (res.ok) {
                const data = await res.json();
                setTerms(data);
                const active = data.find((t: Term) => t.is_active);
                if (active) setSelectedTermId(active.id);
            }
        };
        fetchTerms();
    }, []);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                const queryParams = new URLSearchParams({
                    sin,
                    t: Date.now().toString()
                });

                if (viewerRole) queryParams.append('role', viewerRole);
                if (instructorId) queryParams.append('instructorId', instructorId);
                if (selectedTermId) queryParams.append('termId', selectedTermId);

                const res = await fetch(`/api/student/attendance?${queryParams.toString()}`, { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load attendance");

                setStats({ overall: data.overall_stats, classes: data.class_stats });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error occurred");
            } finally {
                setLoading(false);
            }
        };

        if (sin) fetchAttendance();
    }, [sin, viewerRole, instructorId, selectedTermId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
                <p className="text-sm text-gray-500 font-medium tracking-tight">Syncing attendance records...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 text-red-700 dark:text-red-400 p-6 rounded-2xl flex items-start gap-4 shadow-sm animate-in fade-in duration-300">
                <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold mb-1">Retrieval Failed</h3>
                    <p className="text-sm opacity-90">{error}</p>
                </div>
            </div>
        );
    }

    const ov = stats.overall;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Overall Analytics Grid */}
            {ov && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-nwu-red/5 to-transparent pointer-events-none"></div>

                        <div className="relative h-20 w-20 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 shadow-inner group-hover:scale-105 transition-transform duration-500">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90 p-1">
                                <circle cx="36" cy="36" r="32" className="stroke-current text-gray-100 dark:text-gray-700" strokeWidth="6" fill="none" />
                                <circle
                                    cx="36" cy="36" r="32"
                                    className={`stroke-current ${ov.percentage >= 80 ? 'text-green-500' : ov.percentage >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray="201.06"
                                    strokeDashoffset={201.06 - (201.06 * ov.percentage) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{ov.percentage}%</span>
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-[0.2em] mb-1">Overall Attendance</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">
                                {ov.total === 0 ? 'No Records' : ov.percentage >= 80 ? 'Excellent' : ov.percentage >= 70 ? 'On Track' : 'Needs Review'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col justify-center transition-all hover:bg-green-50/30 dark:hover:bg-green-900/10">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">Present</span>
                            </div>
                            <p className="text-2xl font-black text-green-600 dark:text-green-400">{ov.present}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col justify-center transition-all hover:bg-yellow-50/30 dark:hover:bg-yellow-900/10">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">Late</span>
                            </div>
                            <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{ov.late}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col justify-center transition-all hover:bg-red-50/30 dark:hover:bg-red-900/10">
                            <div className="flex items-center gap-2 mb-1">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">Absent</span>
                            </div>
                            <p className="text-2xl font-black text-red-600 dark:text-red-400">{ov.absent}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col justify-center transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10">
                            <div className="flex items-center gap-2 mb-1">
                                <HelpCircle className="h-4 w-4 text-blue-500" />
                                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">Excused</span>
                            </div>
                            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{ov.excuse_pending}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Subject Breakdown Table */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white tracking-widest flex items-center gap-2">
                        <Activity className="h-4 w-4 text-nwu-red" />
                        Class Breakdown
                    </h3>
                    
                    {terms.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Viewing:</span>
                            <select 
                                value={selectedTermId}
                                onChange={(e) => setSelectedTermId(e.target.value)}
                                className="text-xs font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-nwu-red/20 transition-all cursor-pointer"
                            >
                                {terms.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.academic_years?.name} — {t.name} {t.is_active ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-100 dark:border-gray-700">Class Name</th>
                                <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-100 dark:border-gray-700 text-center">Present</th>
                                <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-100 dark:border-gray-700 text-center">Late</th>
                                <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-100 dark:border-gray-700 text-center">Absent</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-100 dark:border-gray-700">Progress</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-100 dark:border-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {stats.classes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 italic">No enrollment history detected.</td>
                                </tr>
                            ) : (
                                stats.classes.map((cls) => (
                                    <tr key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900 dark:text-white group-hover:text-nwu-red transition-all leading-tight">{cls.subject_name}</p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase mt-1">{cls.year_level || 'General'}</p>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">{cls.present}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-black text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-md">{cls.late}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">{cls.absent}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`text-xs font-black ${cls.percentage >= 80 ? 'text-green-600' : cls.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {cls.percentage}%
                                                </span>
                                                <div className="w-20 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                                    <div
                                                        className={`h-full ${cls.percentage >= 80 ? 'bg-green-500' : cls.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                        style={{ width: `${cls.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!isStudentPortal && (
                                                <Link
                                                    href={`/students/${studentId}/attendance/${cls.id}`}
                                                    className="inline-flex items-center gap-1 text-[10px] font-black text-nwu-red uppercase tracking-widest hover:translate-x-1 transition-transform"
                                                >
                                                    Details
                                                    <ArrowRight className="h-3 w-3" />
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
