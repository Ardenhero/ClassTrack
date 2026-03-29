"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive, RotateCcw, Trash2, Users, BookOpen, Loader2 } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import DashboardLayout from "../../components/DashboardLayout";
import { restoreStudent, permanentlyDeleteStudent } from "../students/actions";
import { restoreClass, permanentlyDeleteClass } from "../classes/actions";
import { getArchivedItems } from "./actions";
import { ConfirmationModal } from "../../components/ConfirmationModal";

interface ArchivedStudent {
    id: string;
    name: string;
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
    const { profile } = useProfile();
    const [tab, setTab] = useState<"students" | "classes">("students");
    const [students, setStudents] = useState<ArchivedStudent[]>([]);
    const [classes, setClasses] = useState<ArchivedClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which item is loading

    // Multi-selection states
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "danger"
    });

    const isAdmin = profile?.role === "admin" && !profile?.is_super_admin;
    const isSuperAdmin = profile?.is_super_admin;
    const isInstructor = profile?.role === "instructor";

    // Dept Admins are read-only on the archive page (no restore, delete, or request)
    const isReadOnly = isAdmin;
    // Both Super Admin and Instructors can permanently delete from their archive
    const canPermanentlyDelete = !isReadOnly;





    const fetchArchived = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);

        const res = await getArchivedItems(profile.id, profile.role, !!isSuperAdmin);

        if (res.error) {
            console.error(res.error);
        } else {
            setStudents(res.students as ArchivedStudent[]);
            setClasses(res.classes as ArchivedClass[]);
        }

        setLoading(false);
    }, [profile, isSuperAdmin]);

    useEffect(() => { if (profile?.id) fetchArchived(); }, [profile?.id, fetchArchived]);

    const handleRestoreStudent = async (id: string) => {
        setActionLoading(`restore-student-${id}`);
        await restoreStudent(id);
        setStudents(prev => prev.filter(s => s.id !== id));
        setActionLoading(null);
    };

    const handleDeleteStudent = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Student Permanently",
            message: "Permanently delete this student? This action CANNOT be undone. All attendance records will be lost.",
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading(`delete-student-${id}`);
                await permanentlyDeleteStudent(id);
                setStudents(prev => prev.filter(s => s.id !== id));
                setActionLoading(null);
            }
        });
    };

    const handleRestoreClass = async (id: string) => {
        setActionLoading(`restore-class-${id}`);
        await restoreClass(id);
        setClasses(prev => prev.filter(c => c.id !== id));
        setActionLoading(null);
    };

    const handleDeleteClass = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Class Permanently",
            message: "Permanently delete this class? This action CANNOT be undone. All enrollment records will be lost.",
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading(`delete-class-${id}`);
                await permanentlyDeleteClass(id);
                setClasses(prev => prev.filter(c => c.id !== id));
                setActionLoading(null);
            }
        });
    };

    // Bulk Actions
    const handleBulkRestore = async (type: "students" | "classes") => {
        const ids = type === "students" ? selectedStudentIds : selectedClassIds;
        if (ids.length === 0) return;
        setActionLoading(`bulk-restore-${type}`);

        try {
            if (type === "students") {
                await Promise.all(ids.map(id => restoreStudent(id)));
                setStudents(prev => prev.filter(s => !ids.includes(s.id)));
                setSelectedStudentIds([]);
            } else {
                await Promise.all(ids.map(id => restoreClass(id)));
                setClasses(prev => prev.filter(c => !ids.includes(c.id)));
                setSelectedClassIds([]);
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleBulkDelete = async (type: "students" | "classes") => {
        const ids = type === "students" ? selectedStudentIds : selectedClassIds;
        if (ids.length === 0) return;

        setConfirmConfig({
            isOpen: true,
            title: `Bulk Delete ${type === "students" ? "Students" : "Classes"}`,
            message: `Permanently delete ${ids.length} ${type}? This action CANNOT be undone.`,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setActionLoading(`bulk-delete-${type}`);
                try {
                    if (type === "students") {
                        await Promise.all(ids.map(id => permanentlyDeleteStudent(id)));
                        setStudents(prev => prev.filter(s => !ids.includes(s.id)));
                        setSelectedStudentIds([]);
                    } else {
                        await Promise.all(ids.map(id => permanentlyDeleteClass(id)));
                        setClasses(prev => prev.filter(c => !ids.includes(c.id)));
                        setSelectedClassIds([]);
                    }
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const toggleStudentSelection = (id: string) => {
        setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleClassSelection = (id: string) => {
        setSelectedClassIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleAllStudents = () => {
        if (selectedStudentIds.length === students.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(students.map(s => s.id));
        }
    };

    const toggleAllClasses = () => {
        if (selectedClassIds.length === classes.length) {
            setSelectedClassIds([]);
        } else {
            setSelectedClassIds(classes.map(c => c.id));
        }
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
                            : isReadOnly
                                ? "Archived items from your department."
                                : "Archived items can be restored or permanently deleted."}
                    </p>
                    {isReadOnly && (
                        <div className="mt-3 px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 uppercase tracking-wider inline-block">
                            Read-Only Mode
                        </div>
                    )}
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                        {tab === "students" ? (
                            students.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">No archived students.</div>
                            ) : (
                                <div>
                                    <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        {!isReadOnly && (
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={students.length > 0 && selectedStudentIds.length === students.length}
                                                    onChange={toggleAllStudents}
                                                    className="w-4 h-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                                />
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                    Select All ({selectedStudentIds.length}/{students.length})
                                                </span>
                                            </label>
                                        )}
                                        {isReadOnly && <span className="text-sm font-bold text-gray-500">{students.length} archived students</span>}

                                        {/* Bulk Actions Menu */}
                                        {selectedStudentIds.length > 0 && (
                                            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
                                                <button
                                                    onClick={() => handleBulkRestore("students")}
                                                    disabled={!!actionLoading}
                                                    className="px-3 py-1.5 text-xs font-bold text-green-700 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center gap-1.5"
                                                >
                                                    {actionLoading === "bulk-restore-students" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore Selected
                                                </button>
                                                {canPermanentlyDelete && (
                                                    <button
                                                        onClick={() => handleBulkDelete("students")}
                                                        disabled={!!actionLoading}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5"
                                                    >
                                                        {actionLoading === "bulk-delete-students" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete Selected
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {students.map(s => (
                                            <div key={s.id} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedStudentIds.includes(s.id) ? "bg-orange-50/50 dark:bg-orange-900/10" : ""}`}>
                                                <div className="flex items-center gap-4">
                                                    {!isReadOnly && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudentIds.includes(s.id)}
                                                            onChange={() => toggleStudentSelection(s.id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red dark:border-gray-600 dark:bg-gray-700 cursor-pointer mt-0.5"
                                                        />
                                                    )}
                                                    <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center font-bold text-sm">
                                                        {(s.name || "?")[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{s.name}</p>
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
                                                    {canPermanentlyDelete && (
                                                        <button
                                                            onClick={() => handleDeleteStudent(s.id)}
                                                            disabled={actionLoading === `delete-student-${s.id}`}
                                                            className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 disabled:opacity-50"
                                                        >
                                                            {actionLoading === `delete-student-${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete Forever
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ) : (
                            classes.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">No archived classes.</div>
                            ) : (
                                <div>
                                    <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        {!isReadOnly && (
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={classes.length > 0 && selectedClassIds.length === classes.length}
                                                    onChange={toggleAllClasses}
                                                    className="w-4 h-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                                />
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                    Select All ({selectedClassIds.length}/{classes.length})
                                                </span>
                                            </label>
                                        )}
                                        {isReadOnly && <span className="text-sm font-bold text-gray-500">{classes.length} archived classes</span>}

                                        {/* Bulk Actions Menu */}
                                        {selectedClassIds.length > 0 && (
                                            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
                                                <button
                                                    onClick={() => handleBulkRestore("classes")}
                                                    disabled={!!actionLoading}
                                                    className="px-3 py-1.5 text-xs font-bold text-green-700 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center gap-1.5"
                                                >
                                                    {actionLoading === "bulk-restore-classes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore Selected
                                                </button>
                                                {canPermanentlyDelete && (
                                                    <button
                                                        onClick={() => handleBulkDelete("classes")}
                                                        disabled={!!actionLoading}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5"
                                                    >
                                                        {actionLoading === "bulk-delete-classes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete Selected
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {classes.map(c => (
                                            <div key={c.id} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedClassIds.includes(c.id) ? "bg-orange-50/50 dark:bg-orange-900/10" : ""}`}>
                                                <div className="flex items-center gap-4">
                                                    {!isReadOnly && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedClassIds.includes(c.id)}
                                                            onChange={() => toggleClassSelection(c.id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red dark:border-gray-600 dark:bg-gray-700 cursor-pointer mt-0.5"
                                                        />
                                                    )}
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
                                                {!isReadOnly && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleRestoreClass(c.id)}
                                                            disabled={actionLoading === `restore-class-${c.id}`}
                                                            className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 disabled:opacity-50"
                                                        >
                                                            {actionLoading === `restore-class-${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
                                                        </button>
                                                        {!isReadOnly && (
                                                            <button
                                                                onClick={() => handleDeleteClass(c.id)}
                                                                disabled={actionLoading === `delete-class-${c.id}`}
                                                                className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 disabled:opacity-50"
                                                            >
                                                                {actionLoading === `delete-class-${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete Forever
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />
        </DashboardLayout>
    );
}
