"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, UserPlus, Users, CheckSquare, Square, Loader2, UserMinus } from "lucide-react";
import { createClient } from "../../utils/supabase/client";
import { DeptBadge } from "../../components/DepartmentGroup";
import { removeStudents } from "./[id]/actions";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface Student {
    id: string;
    name: string;
    sin: string;
    year_level: string;
    department: string | null;
}

interface AssignStudentDialogProps {
    classId: string;
    className?: string;
    instructorId?: string; // Strictly scope to this instructor's directory
    onAssigned?: () => void;
}

export function AssignStudentDialog({ classId, className, instructorId, onAssigned }: AssignStudentDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"available" | "enrolled">("available");
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
    const [search, setSearch] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
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

    const fetchAllStudents = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        // 1. Get students already enrolled in THIS class to filter them out of "available"
        const { data: enrolledData } = await supabase
            .from('enrollments')
            .select('student_id, students(id, name, sin, year_level, department)')
            .eq('class_id', classId);

        const enrolledIds = new Set((enrolledData || []).map((e: { student_id: string }) => e.student_id));
        const enrolledDetails = (enrolledData || []).map((e: { students: Student | null }) => e.students).filter(Boolean) as Student[];

        // Check if user is an admin to determine fetch scope
        const { data: profile } = await supabase
            .from('instructors')
            .select('role, departments(code)')
            .eq('id', instructorId || '')
            .single();

        const isAdmin = profile?.role === 'admin';
        const deptCode = (profile?.departments as { code?: string })?.code;

        type RawStudent = {
            id: string;
            name: string;
            sin: string;
            year_level: string;
            department: string | null;
            is_archived: boolean | null;
            archived_by: string | null;
        };

        let allFetched: RawStudent[] = [];

        if (isAdmin && deptCode) {
            // Admins can assign any student in their department
            const { data } = await supabase
                .from('students')
                .select('id, name, sin, year_level, department, is_archived, archived_by')
                .eq('department', deptCode);
            allFetched = (data as RawStudent[]) || [];
        } else {
            // 2. Fetch students the instructor CREATED
            const createdQuery = supabase
                .from('students')
                .select('id, name, sin, year_level, department, is_archived, archived_by')
                .eq('instructor_id', instructorId || '');

            // 3. Fetch students ENROLLED in any of this instructor's classes (Directory parity)
            const associatedQuery = supabase
                .from('students')
                .select(`
                    id, name, sin, year_level, department, is_archived, archived_by,
                    enrollments!inner (
                        classes!inner (
                            instructor_id
                        )
                    )
                `)
                .eq('enrollments.classes.instructor_id', instructorId || '');

            const [createdRes, associatedRes] = await Promise.all([createdQuery, associatedQuery]);
            allFetched = [...(createdRes.data as RawStudent[] || []), ...(associatedRes.data as RawStudent[] || [])];
        }

        const studentMap = new Map<string, Student>();

        allFetched.forEach((s) => {
            // Respect the directory's archive logic: Only hide if the CURRENT instructor archived them
            if (s.is_archived && s.archived_by === instructorId) return;
            
            studentMap.set(s.id, {
                id: s.id,
                name: s.name,
                sin: s.sin,
                year_level: s.year_level,
                department: s.department
            });
        });

        const available = Array.from(studentMap.values())
            .filter(s => !enrolledIds.has(s.id))
            .sort((a, b) => a.name.localeCompare(b.name));

        setStudents(available);
        setEnrolledStudents(enrolledDetails.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
    }, [classId, instructorId]);

    useEffect(() => {
        if (!isOpen) return;
        fetchAllStudents();
    }, [isOpen, fetchAllStudents]);

    const handleAssignSelected = async () => {
        if (selectedStudentIds.size === 0) return;
        setAssigning(true);
        const supabase = createClient();

        const enrollments = Array.from(selectedStudentIds).map(id => ({
            class_id: classId,
            student_id: id
        }));

        const { error } = await supabase
            .from('enrollments')
            .upsert(enrollments, { onConflict: 'student_id,class_id' });

        if (error) {
            alert(`Failed to assign: ${error.message}`);
        } else {
            // Update lists directly for immediate feedback without re-fetching
            const newlyEnrolled = students.filter(s => selectedStudentIds.has(s.id));
            setEnrolledStudents(prev => [...prev, ...newlyEnrolled].sort((a, b) => a.name.localeCompare(b.name)));
            setStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
            setSelectedStudentIds(new Set());
            onAssigned?.();
            router.refresh();
        }
        setAssigning(false);
    };

    const handleRemoveSelected = async () => {
        if (selectedStudentIds.size === 0) return;

        const count = selectedStudentIds.size;
        const studentText = count === 1 ? 'this student' : `these ${count} students`;
        const classText = className ? ` from ${className}` : '';

        setConfirmConfig({
            isOpen: true,
            title: "Unenroll Students",
            message: `Remove ${studentText}${classText}?\n\nTheir attendance history for this class will be preserved, but they will no longer appear on the roster. You can re-enroll them later.`,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setAssigning(true);
                const { error } = await removeStudents(classId, Array.from(selectedStudentIds));
                if (error) {
                    alert(`Failed to unenroll: ${error}`);
                } else {
                    const newlyAvailable = enrolledStudents.filter(s => selectedStudentIds.has(s.id));
                    setStudents(prev => [...prev, ...newlyAvailable].sort((a, b) => a.name.localeCompare(b.name)));
                    setEnrolledStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
                    setSelectedStudentIds(new Set());
                    onAssigned?.();
                    router.refresh();
                }
                setAssigning(false);
            }
        });
    };

    const targetList = activeTab === "available" ? students : enrolledStudents;

    const filtered = targetList.filter(s => {
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
            // Deselect all filtered
            const newSet = new Set(selectedStudentIds);
            filtered.forEach(s => newSet.delete(s.id));
            setSelectedStudentIds(newSet);
        } else {
            // Select all filtered
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

    // Reset selections when changing tabs
    useEffect(() => {
        setSelectedStudentIds(new Set());
    }, [activeTab]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
            >
                <Users className="h-4 w-4" />
                Manage Students
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col">
                <button
                    onClick={() => { setIsOpen(false); setSelectedStudentIds(new Set()); setSearch(""); }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    Manage Students
                </h2>
                {className && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">for {className}</p>}

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg mb-4">
                    <button
                        onClick={() => setActiveTab("available")}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "available" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                    >
                        Assign Students
                    </button>
                    <button
                        onClick={() => setActiveTab("enrolled")}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "enrolled" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                    >
                        Currently Enrolled
                    </button>
                </div>

                {/* Preview card for selected students */}
                {selectedStudentIds.size > 0 && (
                    <div className={`mb-4 p-4 rounded-xl border ${activeTab === 'available' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {selectedStudentIds.size} student{selectedStudentIds.size !== 1 ? 's' : ''} selected
                            </p>
                            <div className="flex gap-2 mt-3 sm:mt-0">
                                <button
                                    onClick={() => setSelectedStudentIds(new Set())}
                                    className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                {activeTab === "available" ? (
                                    <button
                                        onClick={handleAssignSelected}
                                        disabled={assigning}
                                        className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                        Assign
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleRemoveSelected}
                                        disabled={assigning}
                                        className="px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                                        Unenroll
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="Search by name, SIN, or department..."
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
                                <CheckSquare className={`h-4 w-4 ${activeTab === 'available' ? 'text-blue-600' : 'text-red-500'}`} />
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
                        <div className="p-8 text-center text-gray-400 text-sm">Loading students...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center">
                            <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                                {search
                                    ? "No matching students"
                                    : activeTab === "available"
                                        ? "All students are already enrolled"
                                        : "No students currently enrolled"}
                            </p>
                        </div>
                    ) : (
                        filtered.map(student => {
                            const isSelected = selectedStudentIds.has(student.id);
                            const selectedBgColor = activeTab === 'available' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20';
                            const checkboxColor = activeTab === 'available' ? 'text-blue-600' : 'text-red-500';

                            return (
                                <button
                                    key={student.id}
                                    onClick={() => toggleStudent(student.id)}
                                    className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 ${isSelected ? selectedBgColor : ''}`}
                                >
                                    {isSelected ? (
                                        <CheckSquare className={`h-5 w-5 flex-shrink-0 ${checkboxColor}`} />
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
                                    <DeptBadge department={student.department || ""} />
                                </button>
                            );
                        })
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

                <p className="text-xs text-gray-400 mt-3 text-center">
                    {filtered.length} student{filtered.length !== 1 ? "s" : ""} available
                </p>
            </div>
        </div>
    );
}
