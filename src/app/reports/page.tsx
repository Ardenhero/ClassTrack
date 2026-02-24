"use client";

import { useState, useEffect } from "react";
import { useProfile } from "@/context/ProfileContext";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart3, AlertTriangle, Loader2, TrendingDown, Users, ShieldAlert } from "lucide-react";

interface AtRiskStudent {
    student_id: number;
    name: string;
    sin: string;
    year_level: string;
    total_sessions: number;
    absences: number;
    attendance_rate: number;
    consecutive_absences: number;
    reason: string;
}

export default function ReportsPage() {
    const { profile } = useProfile();

    // At-risk state
    const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [riskLoading, setRiskLoading] = useState(true);

    const isSuperAdmin = profile?.is_super_admin === true;
    const isAdmin = profile?.role === "admin" && !isSuperAdmin;

    useEffect(() => {
        async function loadRisk() {
            if (!profile?.id) return;
            setRiskLoading(true);
            try {
                // Determine scope based on role
                let scope = "instructor";
                if (isSuperAdmin) scope = "super_admin";
                else if (isAdmin) scope = "admin";

                const params = new URLSearchParams({ scope, profile_id: profile.id });
                const res = await fetch(`/api/reports/at-risk?${params}`);
                const data = await res.json();
                if (data.at_risk) setAtRisk(data.at_risk);
                if (data.total_students !== undefined) setTotalStudents(data.total_students);
            } catch (err) {
                console.error("Failed to load at-risk data:", err);
            }
            setRiskLoading(false);
        }
        loadRisk();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id]);

    const riskLevel = (rate: number) => {
        if (rate >= 95) return { label: "🟢 EXCELLENT", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
        if (rate >= 80) return { label: "🟡 GOOD", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
        return { label: "🔴 CRITICAL", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    };

    const scopeLabel = isSuperAdmin ? "System-Wide" : isAdmin ? "Your Department" : "Your Classes";

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-7 w-7 text-nwu-red" />
                    Reports & Monitoring
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Student alerts • Scope: <span className="font-medium text-gray-700 dark:text-gray-300">{scopeLabel}</span>
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStudents}</p>
                            <p className="text-xs text-gray-500">Total Students</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{atRisk.length}</p>
                            <p className="text-xs text-gray-500">Student Alerts</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStudents > 0 ? ((atRisk.length / totalStudents) * 100).toFixed(1) : 0}%
                            </p>
                            <p className="text-xs text-gray-500">Alert Rate</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* At-Risk Monitor — Full Width */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6" />
                        <div>
                            <h2 className="text-lg font-bold">Student Alerts</h2>
                            <p className="text-red-200 text-xs">3+ consecutive absences or &lt;80% attendance</p>
                        </div>
                    </div>
                </div>
                {riskLoading ? (
                    <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
                ) : atRisk.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No student alerts found 🎉</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absences</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Att. %</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consec.</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {atRisk.map((s) => {
                                    const risk = riskLevel(s.attendance_rate);
                                    return (
                                        <tr key={s.student_id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-700 dark:text-red-400 font-bold text-xs">
                                                        {s.name[0]}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div>
                                                        <div className="text-xs text-gray-500">{s.sin} • {s.year_level}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">{s.total_sessions}</td>
                                            <td className="px-5 py-3 text-sm font-semibold text-red-600 dark:text-red-400">{s.absences}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${risk.color}`}>
                                                    {s.attendance_rate}%
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">{s.consecutive_absences}</td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{s.reason}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
