"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Users, BookOpen, Activity, ShieldCheck, UserCheck, AlertCircle } from "lucide-react";
import Link from "next/link";
import { startOfDay } from "date-fns";

interface Instructor {
    id: string;
    name: string | null;
    email: string | null;
    department: string | null;
    classes?: { id: string; name: string; enrollments?: { count?: number }[] }[];
    totalClasses?: number;
    totalStudents?: number;
    status?: string;
}
export function DeptAdminDashboardContent({
    profileId,
    accountInstructorIds,
    scopedDepts
}: {
    profileId: string;
    accountInstructorIds: string[];
    scopedDepts: { code: string }[];
}) {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalInstructors: 0,
        totalClasses: 0,
        totalStudents: 0,
        activeClassesToday: 0
    });

    const [instructors, setInstructors] = useState<Instructor[]>([]);

    // Future stats (overall attendance percentage for the dept)
    // const [attendanceRate, setAttendanceRate] = useState<number | null>(null);

    useEffect(() => {
        async function fetchAdminDashboardData() {
            setLoading(true);

            // 1. Fetch instructors under this Admin
            if (accountInstructorIds.length === 0) {
                setLoading(false);
                return;
            }

            const { data: instructorsData } = await supabase
                .from('instructors')
                .select(`
                    id, 
                    name, 
                    email, 
                    department,
                    classes:classes(id, name, enrollments:enrollments(count))
                `)
                .in('id', accountInstructorIds)
                .neq('id', profileId); // exclude the admin from their own "tracked" list

            const parsedInstructors = (instructorsData || []).map((inst: Instructor) => {
                const totalClasses = inst.classes?.length || 0;
                // Sum up enrollments across all classes
                const totalStudents = inst.classes?.reduce((sum: number, cls: { enrollments?: { count?: number }[] }) => sum + (cls.enrollments?.[0]?.count || 0), 0) || 0;

                return {
                    ...inst,
                    totalClasses,
                    totalStudents,
                    // We will fetch live status separately for better performance
                    status: "offline"
                };
            });

            // 2. Fetch today's attendance to see "active" classes
            const todayStart = startOfDay(new Date()).toISOString();
            const { data: todayLogs } = await supabase
                .from('attendance_logs')
                .select('class_id, timestamp, classes(instructor_id)')
                .gte('timestamp', todayStart)
                .in('classes.instructor_id', accountInstructorIds);

            // Calculate active classes (any class that had a scan in the last 2 hours)
            const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
            const activeClassIds = new Set(
                (todayLogs || [])
                    .filter((log: { timestamp: string, class_id: string }) => new Date(log.timestamp).getTime() > twoHoursAgo)
                    .map((log: { timestamp: string, class_id: string }) => log.class_id)
            );

            // Update instructor statuses
            const instructorsWithStatus = parsedInstructors.map((inst: Instructor) => {
                const hasActiveClass = inst.classes?.some((cls: { id: string }) => activeClassIds.has(cls.id));
                return {
                    ...inst,
                    status: hasActiveClass ? "active" : "offline"
                };
            });

            setInstructors(instructorsWithStatus);

            // 3. Global Stats for Admin
            const totalInst = instructorsWithStatus.length;
            const totalCls = instructorsWithStatus.reduce((sum: number, i: Instructor) => sum + (i.totalClasses || 0), 0);
            const totalStu = instructorsWithStatus.reduce((sum: number, i: Instructor) => sum + (i.totalStudents || 0), 0);

            setStats({
                totalInstructors: totalInst,
                totalClasses: totalCls,
                totalStudents: totalStu,
                activeClassesToday: activeClassIds.size
            });

            setLoading(false);
        }

        fetchAdminDashboardData();
    }, [supabase, profileId, accountInstructorIds]);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
                </div>
                <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Department Overview</h2>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                        Tracking {stats.totalInstructors} instructor(s) in your department
                        {scopedDepts.length > 0 && (
                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
                                {scopedDepts.map(d => d.code).join(", ")}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Instructors"
                    value={stats.totalInstructors}
                    icon={Users}
                    color="blue"
                />
                <StatCard
                    title="Total Classes"
                    value={stats.totalClasses}
                    icon={BookOpen}
                    color="purple"
                />
                <StatCard
                    title="Total Enrolled Students"
                    value={stats.totalStudents}
                    icon={UserCheck}
                    color="emerald"
                />
                <StatCard
                    title="Active Classes (Today)"
                    value={stats.activeClassesToday}
                    icon={Activity}
                    color="nwu-red"
                    trend="+Live"
                />
            </div>

            {/* Main Instructor Tracking View */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-gray-400" />
                        Instructor Tracking View
                    </h3>
                </div>

                {instructors.length === 0 ? (
                    <div className="p-12 text-center">
                        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No Instructors Found</h3>
                        <p className="text-gray-500 mt-1 max-w-sm mx-auto text-sm">You haven&apos;t added any sub-instructors to your department yet. Add instructors from the Administration panel.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Instructor</th>
                                    <th className="px-6 py-4 font-semibold text-center">Department</th>
                                    <th className="px-6 py-4 font-semibold text-center">Classes</th>
                                    <th className="px-6 py-4 font-semibold text-center">Students</th>
                                    <th className="px-6 py-4 font-semibold">Live Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {instructors.map((instructor) => (
                                    <tr key={instructor.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold border border-blue-200 dark:border-blue-800">
                                                    {(instructor.name || instructor.email || "?")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">
                                                        {instructor.name || "Unnamed Instructor"}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{instructor.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300">
                                                {instructor.department || "No Dept"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-mono text-gray-900 dark:text-gray-200">{instructor.totalClasses}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-mono text-gray-900 dark:text-gray-200">{instructor.totalStudents}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {instructor.status === "active" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-w w-2 bg-red-500"></span>
                                                    </span>
                                                    Class Active Now
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                                                    Offline
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {/* Since Dept Admin is read-only, they can only view classes */}
                                            <Link
                                                href={`/classes?query=${instructor.name ? encodeURIComponent(instructor.name) : ""}`}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium whitespace-nowrap"
                                            >
                                                View Classes &rarr;
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}

import React from "react";

// Reusable Stat Card Component
function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: number, icon: React.ElementType, color: string, trend?: string }) {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30",
        purple: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800/30",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/30",
        "nwu-red": "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800/30",
    };

    const activeColorClass = colorClasses[color] || "bg-gray-50 text-gray-600 border-gray-100";

    return (
        <div className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${activeColorClass}`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl bg-white/60 dark:bg-black/20 shadow-sm backdrop-blur-sm`}>
                    <Icon className="h-5 w-5" />
                </div>
                {trend && (
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/60 dark:bg-black/20">
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
                <div className="text-3xl font-black tracking-tight">{value}</div>
            </div>
        </div>
    );
}
