"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw, Trash2, Users, BookOpen, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import DashboardLayout from "@/components/DashboardLayout";
import { restoreStudent, permanentlyDeleteStudent } from "@/app/students/actions";
import { restoreClass, permanentlyDeleteClass } from "@/app/classes/actions";

interface ArchivedStudent {
    id: string;
    full_name: string;
    sin: string | null;
    year_level: string | null;
    archived_at: string | null;
}

interface ArchivedClass {
    id: string;
    name: string;
    year_level: string | null;
    archived_at: string | null;
}

export default function ArchivedPage() {
    const supabase = createClient();
    const { profile } = useProfile();
    const [tab, setTab] = useState<"students" | "classes">("students");
    const [students, setStudents] = useState<ArchivedStudent[]>([]);
    const [classes, setClasses] = useState<ArchivedClass[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = profile?.role === "admin" && !profile?.is_super_admin;
    const isSuperAdmin = profile?.is_super_admin;
    const isInstructor = profile?.role === "instructor";

    // Determine if user can permanently delete (only admins)
    const canPermanentlyDelete = isAdmin || isSuperAdmin;

    const fetchArchived = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);

        if (isSuperAdmin) {
            // Super Admin: see ALL archived
            const [stuRes, clsRes] = await Promise.all([
                supabase.from("students").select("id, full_name, sin, year_level, archived_at").eq("is_archived", true).order("archived_at", { ascending: false }),
                supabase.from("classes").select("id, name, year_level, archived_at").eq("is_archived", true).order("archived_at", { ascending: false }),
            ]);
            if (stuRes.data) setStudents(stuRes.data as ArchivedStudent[]);
            if (clsRes.data) setClasses(clsRes.data as ArchivedClass[]);
        } else if (isAdmin) {
            // System Admin: see archived within their auth_user_id scope
            const { data: adminRecord } = await supabase
                .from("instructors")
                .select("auth_user_id")
                .eq("id", profile.id)
                .single();

            if (adminRecord?.auth_user_id) {
                const { data: accountInstructors } = await supabase
                    .from("instructors")
                    .select("id")
                    .eq("auth_user_id", adminRecord.auth_user_id);

                const ids = (accountInstructors || []).map((i: { id: string }) => i.id);

                if (ids.length > 0) {
                    const [stuRes, clsRes] = await Promise.all([
                        supabase.from("students").select("id, full_name, sin, year_level, archived_at").eq("is_archived", true).in("instructor_id", ids).order("archived_at", { ascending: false }),
                        supabase.from("classes").select("id, name, year_level, archived_at").eq("is_archived", true).in("instructor_id", ids).order("archived_at", { ascending: false }),
                    ]);
                    if (stuRes.data) setStudents(stuRes.data as ArchivedStudent[]);
                    if (clsRes.data) setClasses(clsRes.data as ArchivedClass[]);
                }
            }
        } else {
            // Instructor: only their own archived items
            const [stuRes, clsRes] = await Promise.all([
                supabase.from("students").select("id, full_name, sin, year_level, archived_at").eq("is_archived", true).eq("instructor_id", profile.id).order("archived_at", { ascending: false }),
                supabase.from("classes").select("id, name, year_level, archived_at").eq("is_archived", true).eq("instructor_id", profile.id).order("archived_at", { ascending: false }),
            ]);
            if (stuRes.data) setStudents(stuRes.data as ArchivedStudent[]);
            if (clsRes.data) setClasses(clsRes.data as ArchivedClass[]);
        }

        setLoading(false);
    }, [supabase, profile, isAdmin, isSuperAdmin]);

    useEffect(() => { if (profile?.id) fetchArchived(); }, [profile?.id, fetchArchived]);

    const handleRestoreStudent = async (id: string) => {
        await restoreStudent(id);
        setStudents(prev => prev.filter(s => s.id !== id));
    };

    const handleDeleteStudent = async (id: string) => {
        if (!confirm("Permanently delete this student? This action CANNOT be undone. All attendance records will be lost.")) return;
        await permanentlyDeleteStudent(id);
        setStudents(prev => prev.filter(s => s.id !== id));
    };

    const handleRestoreClass = async (id: string) => {
        await restoreClass(id);
        setClasses(prev => prev.filter(c => c.id !== id));
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm("Permanently delete this class? This action CANNOT be undone. All enrollment records will be lost.")) return;
        await permanentlyDeleteClass(id);
        setClasses(prev => prev.filter(c => c.id !== id));
    };

    const timeAgo = (dateStr: string | null) => {
        if (!dateStr) return "Unknown";
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        return `${days} days ago`;
    };

    return (
        <DashboardLayout>
            <div className="animate-in fade-in duration-500">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Archive className="h-7 w-7 text-orange-500" />
                        Archived
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {isInstructor
                            ? "Your archived students and classes. Restore or contact admin to permanently delete."
                            : "Archived items can be restored or permanently deleted."}
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setTab("students")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === "students" ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-inner dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800" : "bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <Users className="h-4 w-4" />
                        Students ({students.length})
                    </button>
                    <button
                        onClick={() => setTab("classes")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === "classes" ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-inner dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800" : "bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <BookOpen className="h-4 w-4" />
                        Classes ({classes.length})
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        {tab === "students" ? (
                            students.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">No archived students.</div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {students.map(s => (
                                        <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center font-bold text-sm">
                                                    {(s.full_name || "?")[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900 dark:text-white">{s.full_name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {s.sin && <code className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">{s.sin}</code>}
                                                        <span className="text-[10px] text-gray-400">Archived {timeAgo(s.archived_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRestoreStudent(s.id)}
                                                    className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                                >
                                                    <RotateCcw className="h-3 w-3" /> Restore
                                                </button>
                                                {canPermanentlyDelete && (
                                                    <button
                                                        onClick={() => handleDeleteStudent(s.id)}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                                    >
                                                        <Trash2 className="h-3 w-3" /> Delete Forever
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            classes.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">No archived classes.</div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {classes.map(c => (
                                        <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center">
                                                    <BookOpen className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900 dark:text-white">{c.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {c.year_level && <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{c.year_level}</span>}
                                                        <span className="text-[10px] text-gray-400">Archived {timeAgo(c.archived_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRestoreClass(c.id)}
                                                    className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                                >
                                                    <RotateCcw className="h-3 w-3" /> Restore
                                                </button>
                                                {canPermanentlyDelete && (
                                                    <button
                                                        onClick={() => handleDeleteClass(c.id)}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                                    >
                                                        <Trash2 className="h-3 w-3" /> Delete Forever
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
