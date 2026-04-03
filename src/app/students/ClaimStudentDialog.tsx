"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, CheckSquare, Square, Loader2, UserPlus } from "lucide-react";
import { claimStudentsFromPool, getPoolStudentsForInstructor } from "./actions";

interface Student {
    id: string;
    name: string;
    sin: string;
    year_level: string;
    department: string | null;
}

export function ClaimStudentDialog() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [search, setSearch] = useState("");
    const [claiming, setClaiming] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [userDeptCode, setUserDeptCode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"in-dept" | "other">("in-dept");

    const fetchPoolStudents = useCallback(async () => {
        setLoading(true);
        try {
            const { data, userDeptCode } = await getPoolStudentsForInstructor();
            if (data) {
                setStudents(data as Student[]);
                setUserDeptCode(userDeptCode || null);
            }
        } catch (err) {
            console.error("Error fetching students:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        fetchPoolStudents();
    }, [isOpen, fetchPoolStudents]);

    const handleClaimSelected = async () => {
        if (selectedStudentIds.size === 0) return;
        setClaiming(true);

        const { error } = await claimStudentsFromPool(Array.from(selectedStudentIds));

        if (error) {
            alert(`Failed to claim: ${error}`);
        } else {
            // Remove claimed from the local list
            setStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
            setSelectedStudentIds(new Set());
            setIsOpen(false);
            router.refresh();
        }
        setClaiming(false);
    };

    const filtered = students.filter(s => {
        // Tab Filter
        const inDept = s.department === userDeptCode;
        if (activeTab === "in-dept" && !inDept) return false;
        if (activeTab === "other" && inDept) return false;

        const q = search.toLowerCase();
        return (
            (s.name || "").toLowerCase().includes(q) ||
            (s.sin || "").toLowerCase().includes(q) ||
            (s.department || "").toLowerCase().includes(q)
        );
    });

    const isAllSelected = filtered.length > 0 && filtered.every(s => selectedStudentIds.has(s.id));

    const toggleAll = () => {
        if (isAllSelected) {
            const newSet = new Set(selectedStudentIds);
            filtered.forEach(s => newSet.delete(s.id));
            setSelectedStudentIds(newSet);
        } else {
            const newSet = new Set(selectedStudentIds);
            filtered.forEach(s => newSet.add(s.id));
            setSelectedStudentIds(newSet);
        }
    };

    const toggleStudent = (id: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedStudentIds(newSet);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700 font-medium whitespace-nowrap"
            >
                <UserPlus className="h-4 w-4 text-blue-500" />
                Add from List
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col">
                        <button
                            onClick={() => { setIsOpen(false); setSelectedStudentIds(new Set()); setSearch(""); }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            Students from Department Enrollment List
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Select students from the Department Enrollment List to add to your directory.
                        </p>

                        {/* Preview card for selected students */}
                        {selectedStudentIds.size > 0 && (
                            <div className="mb-4 p-4 rounded-xl border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {selectedStudentIds.size} student{selectedStudentIds.size !== 1 ? 's' : ''} selected
                                    </p>
                                    <div className="flex gap-2 mt-3 sm:mt-0">
                                        <button
                                            onClick={handleClaimSelected}
                                            disabled={claiming}
                                            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 mb-4 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl w-full">
                            <button
                                onClick={() => setActiveTab("in-dept")}
                                className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "in-dept" ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                            >
                                In Dept
                            </button>
                            <button
                                onClick={() => setActiveTab("other")}
                                className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "other" ? "bg-white dark:bg-gray-800 text-gray-500 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                            >
                                Other Dept
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white text-sm"
                                placeholder={`Search ${activeTab === "in-dept" ? "department " : ""}by name, SIN...`}
                            />
                        </div>

                        {/* Select All Toggle */}
                        {filtered.length > 0 && !loading && (
                            <div className="flex items-center justify-between mb-2">
                                <button
                                    onClick={toggleAll}
                                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                    {isAllSelected ? (
                                        <CheckSquare className="h-4 w-4 text-blue-600" />
                                    ) : (
                                        <Square className="h-4 w-4" />
                                    )}
                                    <span className="font-medium">Select All</span>
                                </button>
                            </div>
                        )}

                        {/* Student list */}
                        <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400 text-sm">Loading available students...</div>
                            ) : filtered.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">
                                        {search
                                            ? "No matching students"
                                            : "No students available to add to your directory"}
                                    </p>
                                </div>
                            ) : (
                                filtered.map(student => {
                                    const isSelected = selectedStudentIds.has(student.id);

                                    return (
                                        <button
                                            key={student.id}
                                            onClick={() => toggleStudent(student.id)}
                                            className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            {isSelected ? (
                                                <CheckSquare className="h-5 w-5 flex-shrink-0 text-blue-600" />
                                            ) : (
                                                <Square className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                                            )}
                                            <div className="h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-gray-500">
                                                {student.name[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <span className="font-mono">{student.sin}</span>
                                                    <span>•</span>
                                                    <span>{student.year_level}</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <p className="text-xs text-gray-400 mt-3 text-center">
                            {filtered.length} student{filtered.length !== 1 ? "s" : ""} available
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
