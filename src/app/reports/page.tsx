"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart3, AlertTriangle, Download, Loader2, TrendingDown, Users, ShieldAlert } from "lucide-react";

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
    const supabase = createClient();

    // At-risk state
    const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [riskLoading, setRiskLoading] = useState(true);

    // Export state
    const [yearLevels, setYearLevels] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        // Fetch at-risk students
        async function loadRisk() {
            setRiskLoading(true);
            try {
                const res = await fetch("/api/reports/at-risk");
                const data = await res.json();
                if (data.at_risk) setAtRisk(data.at_risk);
                if (data.total_students) setTotalStudents(data.total_students);
            } catch (err) {
                console.error("Failed to load at-risk data:", err);
            }
            setRiskLoading(false);
        }
        loadRisk();

        // Fetch year levels for export filter
        async function loadYears() {
            const { data } = await supabase
                .from("students")
                .select("year_level")
                .order("year_level");
            if (data) {
                const unique = Array.from(new Set(data.map((s: { year_level: string }) => s.year_level))).filter(Boolean);
                setYearLevels(unique as string[]);
            }
        }
        loadYears();

        // Default date range: last 6 months
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        setDateTo(now.toISOString().split("T")[0]);
        setDateFrom(sixMonthsAgo.toISOString().split("T")[0]);
    }, [supabase]);

    const handleExport = async () => {
        if (!dateFrom || !dateTo) return;
        setExporting(true);
        try {
            const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
            if (selectedYear) params.set("year_level", selectedYear);

            const res = await fetch(`/api/reports/semester-export?${params}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `attendance_report_${dateFrom}_to_${dateTo}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Export failed:", err);
        } finally {
            setExporting(false);
        }
    };

    const riskLevel = (rate: number) => {
        if (rate >= 95) return { label: "EXCELLENT", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
        if (rate >= 80) return { label: "GOOD", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
        return { label: "AT-RISK", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    };

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-7 w-7 text-nwu-red" />
                    Reports & Monitoring
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">At-risk alerts and semester attendance export</p>
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
                            <p className="text-xs text-gray-500">At-Risk Students</p>
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
                            <p className="text-xs text-gray-500">At-Risk Rate</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* At-Risk Monitor */}
                <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6" />
                            <div>
                                <h2 className="text-lg font-bold">At-Risk Students</h2>
                                <p className="text-red-200 text-xs">3+ consecutive absences or &lt;80% attendance</p>
                            </div>
                        </div>
                    </div>
                    {riskLoading ? (
                        <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
                    ) : atRisk.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No at-risk students found 🎉</div>
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

                {/* Semester Export */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <Download className="h-6 w-6" />
                            <div>
                                <h2 className="text-lg font-bold">Semester Export</h2>
                                <p className="text-indigo-200 text-xs">Download attendance summary as CSV</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Year Level (optional)</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                            >
                                <option value="">All Year Levels</option>
                                {yearLevels.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Date From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Date To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                            />
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={!dateFrom || !dateTo || exporting}
                            className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
