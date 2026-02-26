"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw, Trash2, Users, BookOpen, Loader2, MessageSquare } from "lucide-react";
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
    const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which item is loading
    const [requestModal, setRequestModal] = useState<{ type: "student" | "class"; id: string; name: string } | null>(null);
    const [requestReason, setRequestReason] = useState("");
    const [requestSubmitting, setRequestSubmitting] = useState(false);

    const isAdmin = profile?.role === "admin" && !profile?.is_super_admin;
    const isSuperAdmin = profile?.is_super_admin;
    const isInstructor = profile?.role === "instructor";

    // Only admins can permanently delete directly
    const canPermanentlyDelete = isAdmin || isSuperAdmin;

    const fetchArchived = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);

        if (isSuperAdmin) {
            const [stuRes, clsRes] = await Promise.all([
                supabase.from("students").select("id, full_name, sin, year_level, archived_at").eq("is_archived", true).order("archived_at", { ascending: false }),
                supabase.from("classes").select("id, name, year_level, archived_at").eq("is_archived", true).order("archived_at", { ascending: false }),
            ]);
            if (stuRes.data) setStudents(stuRes.data as ArchivedStudent[]);
            if (clsRes.data) setClasses(clsRes.data as ArchivedClass[]);
        } else if (isAdmin) {
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
        setActionLoading(`restore-student-${id}`);
        await restoreStudent(id);
        setStudents(prev => prev.filter(s => s.id !== id));
        setActionLoading(null);
    };

    const handleDeleteStudent = async (id: string) => {
        if (!confirm("Permanently delete this student? This action CANNOT be undone. All attendance records will be lost.")) return;
        setActionLoading(`delete-student-${id}`);
        await permanentlyDeleteStudent(id);
        setStudents(prev => prev.filter(s => s.id !== id));
        setActionLoading(null);
    };

    const handleRestoreClass = async (id: string) => {
        setActionLoading(`restore-class-${id}`);
        await restoreClass(id);
        setClasses(prev => prev.filter(c => c.id !== id));
        setActionLoading(null);
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm("Permanently delete this class? This action CANNOT be undone. All enrollment records will be lost.")) return;
        setActionLoading(`delete-class-${id}`);
        await permanentlyDeleteClass(id);
        setClasses(prev => prev.filter(c => c.id !== id));
        setActionLoading(null);
    };

    const handleRequestDeletion = async () => {
        if (!requestModal || !profile?.id) return;
        setRequestSubmitting(true);

        await supabase.from("deletion_requests").insert({
            entity_type: requestModal.type,
            entity_id: requestModal.id,
            entity_name: requestModal.name,
            requested_by: profile.id,
            reason: requestReason || "No reason provided",
            status: "pending",
        });

        // Audit log
        await supabase.from("audit_logs").insert({
            action: "deletion_request_created",
            entity_type: requestModal.type,
            entity_id: requestModal.id,
            details: `Instructor requested permanent deletion of ${requestModal.type} "${requestModal.name}". Reason: ${requestReason || "No reason provided"}`,
            performed_by: profile.id,
        });

        setRequestSubmitting(false);
        setRequestModal(null);
        setRequestReason("");
        alert("Deletion request sent to your Department Administrator for approval.");
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
                            ? "Your archived students and classes. Restore or request admin approval to permanently delete."
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
                                                    disabled={actionLoading === `restore-student-${s.id}`}
                                                    className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 disabled:opacity-50"
                                                >
                                                    {actionLoading === `restore-student-${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
                                                </button>
                                                {canPermanentlyDelete ? (
                                                    <button
                                                        onClick={() => handleDeleteStudent(s.id)}
                                                        disabled={actionLoading === `delete-student-${s.id}`}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 disabled:opacity-50"
                                                    >
                                                        {actionLoading === `delete-student-${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete Forever
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setRequestModal({ type: "student", id: s.id, name: s.full_name })}
                                                        className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                                    >
                                                        <MessageSquare className="h-3 w-3" /> Request Deletion
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
                                                    disabled={actionLoading === `restore-class-${c.id}`}
                                                    className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 disabled:opacity-50"
                                                >
                                                    {actionLoading === `restore-class-${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
                                                </button>
                                                {canPermanentlyDelete ? (
                                                    <button
                                                        onClick={() => handleDeleteClass(c.id)}
                                                        disabled={actionLoading === `delete-class-${c.id}`}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 disabled:opacity-50"
                                                    >
                                                        {actionLoading === `delete-class-${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete Forever
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setRequestModal({ type: "class", id: c.id, name: c.name })}
                                                        className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                                    >
                                                        <MessageSquare className="h-3 w-3" /> Request Deletion
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

                {/* Deletion Request Modal */}
                {requestModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Request Permanent Deletion</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                This will send a request to your Department Administrator to permanently delete
                                <strong className="text-gray-900 dark:text-white"> {requestModal.name}</strong>.
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (optional)</label>
                                <textarea
                                    value={requestReason}
                                    onChange={e => setRequestReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:text-white"
                                    rows={3}
                                    placeholder="Why should this be permanently deleted?"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setRequestModal(null); setRequestReason(""); }}
                                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestDeletion}
                                    disabled={requestSubmitting}
                                    className="px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {requestSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                                    Send Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
