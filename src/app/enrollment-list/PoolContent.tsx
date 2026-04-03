"use client";

import { useState, useMemo } from "react";
import { Search, Users, GraduationCap, UserPlus, MoreHorizontal, Trash2, Loader2, CheckSquare, Square, History, UserMinus, UserCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AddStudentDialog } from "@/app/students/AddStudentDialog";
import { unenrollStudentFromDepartment, promoteStudentsBatch, type PoolStudent } from "./actions";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { BatchActionBar } from "./BatchActionBar";
import { useRouter } from "next/navigation";

interface PoolContentProps {
    students: PoolStudent[];
    departmentName: string | null;
    isSuperAdmin: boolean;
    deptCode: string | null;
}

export default function PoolContent({ students, departmentName, isSuperAdmin, deptCode }: PoolContentProps) {
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState<string | null>(null);
    const [statusTab, setStatusTab] = useState<"active" | "graduated" | "dropped" | "other">("active");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showMenuId, setShowMenuId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const router = useRouter();
    const canEdit = !isSuperAdmin; // Allow Dept Admins to manage the pool, restrict Super Admins

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
        variant: "warning"
    });

    const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

    const filtered = useMemo(() => {
        return students.filter(s => {
            // Status Tab Filter
            const sStatus = (s.enrollment_status || 'active').toLowerCase();
            const sDept = s.department;

            if (statusTab === 'active') {
                if (sStatus !== 'active') return false;
                if (deptCode && sDept !== deptCode) return false; // Filter out other depts in active tab
            }
            if (statusTab === 'graduated') {
                if (sStatus !== 'graduated') return false;
                if (deptCode && sDept !== deptCode) return false;
            }
            if (statusTab === 'dropped') {
                if (sStatus !== 'dropped' && sStatus !== 'transferred') return false;
                if (deptCode && sDept !== deptCode) return false;
            }
            if (statusTab === 'other') {
                if (deptCode && sDept === deptCode) return false; // Only show other depts
            }

            const q = search.toLowerCase();
            const matchesSearch = !q ||
                (s.name || '').toLowerCase().includes(q) ||
                (s.sin || '').toLowerCase().includes(q);
            const matchesYear = !yearFilter || (s.year_level === yearFilter);
            return matchesSearch && matchesYear;
        });
    }, [students, search, yearFilter, statusTab]);

    // Stats
    const totalStudents = students.length;
    const activeCount = students.filter(s => (s.enrollment_status || 'active') === 'active').length;
    const currentViewCount = filtered.length;

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selected.size === filtered.length && filtered.length > 0) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map(s => s.id)));
        }
    };

    const handleUpdateStatus = async (studentId: string, newStatus: string) => {
        const { error } = await promoteStudentsBatch([studentId], students.find(s => s.id === studentId)?.year_level || "1st Year", newStatus);
        if (error) alert(error);
        else {
            setShowMenuId(null);
            router.refresh();
        }
    };

    const breadcrumbItems = [
        { label: "Enrollment List" },
    ];

    return (
        <>
            <Breadcrumb items={breadcrumbItems} />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Department Enrollment List
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {departmentName
                            ? `Students of ${departmentName}`
                            : "Manage all students in your department"}
                    </p>
                </div>
                {canEdit ? (
                    <AddStudentDialog
                        trigger={
                            <button className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add to List
                            </button>
                        }
                    />
                ) : (
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 uppercase tracking-wider">
                        Read-Only Mode
                    </div>
                )}
            </div>

            {/* Batch Actions Bar */}
            {canEdit && (
                <BatchActionBar
                    selectedIds={Array.from(selected)}
                    onClear={() => setSelected(new Set())}
                    onSuccess={() => {
                        setSelected(new Set());
                        router.refresh();
                    }}
                />
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total in Dept</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalStudents}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="flex items-center gap-2 mb-1">
                        <GraduationCap className="h-4 w-4 text-purple-500" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current View</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{currentViewCount}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="flex items-center gap-2 mb-1">
                        <History className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Filter</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white capitalize truncate">{statusTab}</div>
                </div>
            </div>

            {/* Tabs for Status */}
            <div className="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl w-fit">
                <button
                    onClick={() => setStatusTab("active")}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${statusTab === "active" ? "bg-white dark:bg-gray-800 text-nwu-red shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                    Active Students
                </button>
                <button
                    onClick={() => setStatusTab("graduated")}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${statusTab === "graduated" ? "bg-white dark:bg-gray-800 text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                    Graduated
                </button>
                <button
                    onClick={() => setStatusTab("dropped")}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${statusTab === "dropped" ? "bg-white dark:bg-gray-800 text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                    Dropped / Transferred
                </button>
                <button
                    onClick={() => setStatusTab("other")}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${statusTab === "other" ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                    Other Dept
                </button>
            </div>

            {/* Search + Year Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        aria-label="Search students by name or SIN"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-800 dark:text-white text-sm"
                        placeholder="Search by name or SIN..."
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setYearFilter(null)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${!yearFilter
                            ? "bg-nwu-red text-white border-nwu-red"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300"
                            }`}
                    >
                        All Years
                    </button>
                    {years.map(yr => (
                        <button
                            key={yr}
                            onClick={() => setYearFilter(yearFilter === yr ? null : yr)}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${yearFilter === yr
                                ? "bg-nwu-red text-white border-nwu-red"
                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300"
                                }`}
                        >
                            {yr}
                        </button>
                    ))}
                </div>
            </div>

            {/* Student Table */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                {filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {search || yearFilter ? "No students match your filters in this category" : `No ${statusTab} students found`}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                    <th className="w-10 px-4 py-3 text-center">
                                        <button onClick={handleSelectAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                                            {selected.size === filtered.length && filtered.length > 0
                                                ? <CheckSquare className="h-4 w-4 text-nwu-red" />
                                                : <Square className="h-4 w-4" />
                                            }
                                        </button>
                                    </th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest">Student</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest">SIN</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest">Year Level</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest">Classes</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest">Status</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.map(student => (
                                    <tr key={student.id} className={`group hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors ${selected.has(student.id) ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(student.id)}
                                                onChange={() => toggleSelect(student.id)}
                                                aria-label={`Select ${student.name} for bulk action`}
                                                className="h-4 w-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 font-bold shrink-0 overflow-hidden relative border border-gray-200 dark:border-gray-600 group-hover:border-nwu-red/30 transition-colors">
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
                                                <div className="flex flex-col">
                                                    <Link href={`/students/${student.id}`} className="text-sm font-bold text-gray-900 dark:text-white truncate hover:text-nwu-red transition-all">
                                                        {student.name}
                                                    </Link>
                                                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Created {new Date(student.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-mono font-bold text-gray-600 dark:text-gray-400">{student.sin}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg font-bold">
                                                {student.year_level}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-sm font-bold ${student.enrollment_count > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                                {student.enrollment_count > 0 ? `${student.enrollment_count} Active Class${student.enrollment_count !== 1 ? "es" : ""}` : "Unenrolled"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded w-fit ${(student.enrollment_status || 'active') === 'graduated' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                                                    (student.enrollment_status || 'active') === 'dropped' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                                        (student.enrollment_status || 'active') === 'transferred' ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                                                            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    }`}>
                                                    {student.enrollment_status || 'active'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="relative">
                                                {canEdit && (
                                                    <button onClick={() => setShowMenuId(showMenuId === student.id ? null : student.id)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {showMenuId === student.id && (
                                                    <div className="absolute right-6 top-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 py-2 animate-in fade-in slide-in-from-right-2 duration-200" onMouseLeave={() => setShowMenuId(null)}>
                                                        <p className="px-4 py-2 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-50 dark:border-gray-700 mb-1">Actions</p>

                                                        {statusTab !== 'active' && (
                                                            <button
                                                                onClick={() => handleUpdateStatus(student.id, 'active')}
                                                                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
                                                            >
                                                                <UserCheck className="h-4 w-4" />
                                                                Re-activate Student
                                                            </button>
                                                        )}

                                                        {statusTab === 'active' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(student.id, 'graduated')}
                                                                    className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
                                                                >
                                                                    <GraduationCap className="h-4 w-4" />
                                                                    Mark as Graduated
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(student.id, 'dropped')}
                                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                                >
                                                                    <UserMinus className="h-4 w-4" />
                                                                    Mark as Dropped / Transferred
                                                                </button>
                                                            </>
                                                        )}

                                                        <div className="my-1 border-t border-gray-50 dark:border-gray-700"></div>

                                                        <button
                                                            onClick={() => {
                                                                setConfirmConfig({
                                                                    isOpen: true,
                                                                    title: "EXTREME CAUTION: Permanent Deletion",
                                                                    message: "Are you sure? This 'Unenroll' action permanently WIPES this student and ALL their history (attendance, bio-data, classes) from the system. This cannot be undone.",
                                                                    variant: "danger",
                                                                    onConfirm: async () => {
                                                                        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                                                        setDeletingId(student.id);
                                                                        await unenrollStudentFromDepartment(student.id);
                                                                        setDeletingId(null);
                                                                        setShowMenuId(null);
                                                                        router.refresh();
                                                                    }
                                                                });
                                                            }}
                                                            disabled={deletingId === student.id}
                                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 disabled:opacity-50 font-bold"
                                                        >
                                                            {deletingId === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                            Unenroll (Permanent Delete)
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer count */}
            <p className="text-xs text-gray-400 mt-4 text-center font-medium">
                Showing {filtered.length} of {totalStudents} department record{totalStudents !== 1 ? "s" : ""}
            </p>

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
                confirmLabel="Confirm Permanent Delete"
            />
        </>
    );
}
