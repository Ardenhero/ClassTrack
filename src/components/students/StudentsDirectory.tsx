"use client";

import React, { useState, useMemo } from "react";
import { getDeptColor, DepartmentGroup } from "@/components/DepartmentGroup";
import { YearGroup } from "@/components/YearGroup";
import StudentGrid from "@/app/students/StudentGrid";
import { AdminDirectoryGroup } from "@/components/admin/AdminDirectoryGroup";
import type { Department } from "@/lib/departments";
import { useStudents } from "@/hooks/useStudents";

interface StudentEnrollment {
    instructorId: string;
    instructorName: string;
    instructorImageUrl: string | null;
}

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    department?: string;
    instructor_id?: string;
    instructor_name?: string;
    instructor_image_url?: string | null;
    fingerprint_slot_id?: number | null;
    image_url?: string | null;
    enrollments?: StudentEnrollment[];
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export function StudentsDirectory({
    students: initialStudents,
    departments,
    isSuperAdmin,
    isAdmin,
    homeCollege,
    homeDeptCodes,
    initialInstructorId,
}: {
    students: Student[];
    departments: Department[];
    isSuperAdmin: boolean;
    isAdmin?: boolean;
    homeCollege: string | null;
    homeDeptCodes: string[];
    initialInstructorId?: string;
}) {
    const { students } = useStudents(undefined, initialStudents);
    const [activeDept, setActiveDept] = useState("");
    const [activeYear, setActiveYear] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // INSTANT client-side filtering — zero server round-trips
    const filtered = useMemo(() => {
        let result = students;

        // If not admin, ONLY show students actively assigned to this instructor's directory
        if (!isAdmin && !isSuperAdmin && initialInstructorId) {
            result = result.filter((s: Student) => s.instructor_id === initialInstructorId);
        }

        if (activeDept) {
            result = result.filter((s: Student) => (s.department || "").toUpperCase() === activeDept.toUpperCase());
        }
        if (activeYear) {
            result = result.filter((s: Student) => s.year_level === activeYear);
        }
        return result;
    }, [students, activeDept, activeYear, isAdmin, isSuperAdmin, initialInstructorId]);

    // Group by department
    const { homeDepts, otherDepts, departmentMap } = useMemo(() => {
        const deptMap = new Map<string, Student[]>();
        filtered.forEach((s: Student) => {
            const dept = s.department || "Unassigned";
            if (!deptMap.has(dept)) deptMap.set(dept, []);
            deptMap.get(dept)!.push(s);
        });

        const sortedDepts = Array.from(deptMap.keys()).sort((a, b) => {
            if (a === "Unassigned") return 1;
            if (b === "Unassigned") return -1;
            return a.localeCompare(b);
        });

        const home: string[] = [];
        const other: string[] = [];
        const homeSet = new Set(homeDeptCodes);

        if (isSuperAdmin || !homeCollege) {
            home.push(...sortedDepts);
        } else {
            sortedDepts.forEach(dept => {
                if (homeSet.has(dept)) home.push(dept);
                else other.push(dept);
            });
        }

        return { homeDepts: home, otherDepts: other, departmentMap: deptMap };
    }, [filtered, isSuperAdmin, homeCollege, homeDeptCodes]);

    const toggleDept = (code: string) => {
        setActiveDept((prev: string) => prev === code ? "" : code);
        setSelectedIds([]);
    };
    const toggleYear = (year: string) => {
        setActiveYear((prev: string) => prev === year ? "" : year);
        setSelectedIds([]);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev: string[]) =>
            prev.includes(id) ? prev.filter((i: string) => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (items: Student[]) => {
        const itemIds = items.map((i: Student) => i.id);
        const allSelected = itemIds.every((id: string) => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds((prev: string[]) => prev.filter((id: string) => !itemIds.includes(id)));
        } else {
            setSelectedIds((prev: string[]) => Array.from(new Set([...prev, ...itemIds])));
        }
    };

    // Render helper for the inner department/year grouping
    const renderStudentGroups = (studentList: Student[], isHome: boolean, map: Map<string, Student[]>, depts: string[]) => {
        return depts.map((dept: string) => {
            const deptStudents = studentList.filter((s: Student) => (s.department || "Unassigned") === dept);
            if (deptStudents.length === 0) return null;

            const yearGrouped = YEAR_LEVELS.reduce((acc, level) => {
                const items = deptStudents.filter((s: Student) => s.year_level === level);
                if (items.length > 0) acc[level] = items;
                return acc;
            }, {} as Record<string, Student[]>);
            const otherStudents = deptStudents.filter((s: Student) => !YEAR_LEVELS.includes(s.year_level || ""));
            if (otherStudents.length > 0) yearGrouped["Other"] = otherStudents;

            return (
                <DepartmentGroup key={dept} department={dept} count={deptStudents.length} itemLabel="students" defaultOpen={depts.length === 1}>
                    {Object.entries(yearGrouped).map(([level, items]) => (
                        <YearGroup key={level} title={level} count={items.length} itemLabel="students">
                            <StudentGrid
                                students={items}
                                isSuperAdmin={isSuperAdmin}
                                isAdmin={isAdmin}
                                departments={departments}
                                selectedIds={selectedIds}
                                onToggleSelect={toggleSelect}
                                onSelectAll={() => handleSelectAll(items)}
                            />
                        </YearGroup>
                    ))}
                </DepartmentGroup>
            );
        });
    };

    // If Admin, group by instructor (via enrollments)
    const adminGroups = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, Student[]>();
        filtered.forEach((s: Student) => {
            if (s.enrollments && s.enrollments.length > 0) {
                s.enrollments.forEach((e: StudentEnrollment) => {
                    if (!map.has(e.instructorId)) map.set(e.instructorId, []);
                    if (!map.get(e.instructorId)!.some((existing: Student) => existing.id === s.id)) {
                        map.get(e.instructorId)!.push({
                            ...s,
                            instructor_name: e.instructorName,
                            instructor_image_url: e.instructorImageUrl
                        });
                    }
                });
            } else {
                const key = "unassigned";
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(s);
            }
        });

        return Array.from(map.entries()).sort((a, b) => {
            if (a[0] === "unassigned") return 1;
            if (b[0] === "unassigned") return -1;
            const nameA = a[1][0]?.instructor_name || "Unassigned";
            const nameB = b[1][0]?.instructor_name || "Unassigned";
            return nameA.localeCompare(nameB);
        });
    }, [filtered, isAdmin]);

    const superAdminGroups = useMemo(() => {
        if (!isSuperAdmin) return new Map<string, Map<string, Student[]>>();
        const deptMap = new Map<string, Map<string, Student[]>>();

        filtered.forEach((s: Student) => {
            const dept = s.department || "Unassigned";
            if (!deptMap.has(dept)) deptMap.set(dept, new Map());

            const instMap = deptMap.get(dept)!;

            if (s.enrollments && s.enrollments.length > 0) {
                s.enrollments.forEach((e: StudentEnrollment) => {
                    const instId = e.instructorId;
                    if (!instMap.has(instId)) instMap.set(instId, []);

                    if (!instMap.get(instId)!.some((existing: Student) => existing.id === s.id)) {
                        instMap.get(instId)!.push({
                            ...s,
                            instructor_name: e.instructorName,
                            instructor_image_url: e.instructorImageUrl
                        });
                    }
                });
            } else {
                const instId = "unassigned";
                if (!instMap.has(instId)) instMap.set(instId, []);
                instMap.get(instId)!.push(s);
            }
        });

        // Sort departments alphabetically with Unassigned at the end
        const sortedMap = new Map<string, Map<string, Student[]>>();
        const sortedKeys = Array.from(deptMap.keys()).sort((a, b) => {
            if (a === "Unassigned") return 1;
            if (b === "Unassigned") return -1;
            return a.localeCompare(b);
        });

        sortedKeys.forEach(k => {
            const instMap = deptMap.get(k)!;
            // Sort instructors within each department
            const sortedInstEntries = Array.from(instMap.entries()).sort((a, b) => {
                if (a[0] === "unassigned") return 1;
                if (b[0] === "unassigned") return -1;
                const nameA = a[1][0]?.instructor_name || "Unassigned";
                const nameB = b[1][0]?.instructor_name || "Unassigned";
                return nameA.localeCompare(nameB);
            });
            const sortedInstMap = new Map(sortedInstEntries);
            sortedMap.set(k, sortedInstMap);
        });

        return sortedMap;
    }, [filtered, isSuperAdmin]);

    return (
        <>
            {/* Inline Filter Chips — instant, no navigation */}
            <div className="mb-6 space-y-3">
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-center mr-1">Dept:</span>
                    {departments.map(dept => {
                        const isActive = activeDept === dept.code;
                        const c = getDeptColor(dept.code);
                        return (
                            <button
                                key={dept.id}
                                onClick={() => toggleDept(dept.code)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${isActive
                                    ? `${c.bg} ${c.text} ${c.border} ring-2 ring-offset-1 ring-current`
                                    : "bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                                    }`}
                            >
                                {dept.code}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-center mr-1">Year:</span>
                    {YEAR_LEVELS.map(year => {
                        const isActive = activeYear === year;
                        return (
                            <button
                                key={year}
                                onClick={() => toggleYear(year)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${isActive
                                    ? "bg-nwu-red/10 text-nwu-red border-nwu-red ring-2 ring-offset-1 ring-nwu-red/30"
                                    : "bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                                    }`}
                            >
                                {year}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    No students found.
                </div>
            )}

            {/* Grouped Content */}
            {filtered.length > 0 && (
                <div className="space-y-8">
                    {isAdmin && !isSuperAdmin ? (
                        // ADMIN VIEW: Folders per Instructor
                        <div className="space-y-2">
                            {adminGroups.map(([instructorId, instructorStudents], index) => {
                                const instName = instructorId === "unassigned" ? "Unassigned / Not Enrolled" : (instructorStudents[0]?.instructor_name || "Unknown Instructor");

                                return (
                                    <AdminDirectoryGroup
                                        key={instructorId}
                                        instructorId={instructorId}
                                        instructorName={instName}
                                        instructorImageUrl={instructorStudents[0]?.instructor_image_url}
                                        count={instructorStudents.length}
                                        itemLabel="students"
                                        defaultOpen={initialInstructorId ? instructorId === initialInstructorId : index === 0}
                                    >
                                        <div className="pt-2 pb-4 px-2">
                                            <StudentGrid
                                                students={instructorStudents}
                                                isSuperAdmin={isSuperAdmin}
                                                isAdmin={isAdmin}
                                                departments={departments}
                                                selectedIds={selectedIds}
                                                onToggleSelect={toggleSelect}
                                                onSelectAll={() => handleSelectAll(instructorStudents)}
                                                folderInstructorId={instructorId}
                                            />
                                        </div>
                                    </AdminDirectoryGroup>
                                );
                            })}
                        </div>
                    ) : isSuperAdmin ? (
                        // ADMINISTRATOR VIEW: Department -> Folders per Instructor
                        <div className="space-y-6">
                            {Array.from(superAdminGroups.entries()).map(([dept, instMap], deptIndex) => {
                                const instructorEntries = Array.from(instMap.entries()).sort((a, b) => {
                                    const nameA = a[1][0]?.instructor_name || "Unassigned";
                                    const nameB = b[1][0]?.instructor_name || "Unassigned";
                                    return nameA.localeCompare(nameB);
                                });

                                let totalDeptStudents = 0;
                                instructorEntries.forEach(([, students]) => totalDeptStudents += students.length);

                                return (
                                    <DepartmentGroup key={dept} department={dept} count={totalDeptStudents} itemLabel="students" defaultOpen={superAdminGroups.size === 1 || deptIndex === 0}>
                                        <div className="space-y-2 pb-2">
                                            {instructorEntries.map(([instructorId, instructorStudents]) => {
                                                const instName = instructorId === "unassigned" ? "Unassigned / Not Enrolled" : (instructorStudents[0]?.instructor_name || "Unknown Instructor");
                                                return (
                                                    <AdminDirectoryGroup
                                                        key={instructorId}
                                                        instructorId={instructorId}
                                                        instructorName={instName}
                                                        instructorImageUrl={instructorStudents[0]?.instructor_image_url}
                                                        count={instructorStudents.length}
                                                        itemLabel="students"
                                                        defaultOpen={initialInstructorId ? instructorId === initialInstructorId : undefined}
                                                    >
                                                        <div className="pt-2 pb-4 px-2">
                                                            <StudentGrid
                                                                students={instructorStudents}
                                                                isSuperAdmin={isSuperAdmin}
                                                                isAdmin={isAdmin}
                                                                departments={departments}
                                                                selectedIds={selectedIds}
                                                                onToggleSelect={toggleSelect}
                                                                onSelectAll={() => handleSelectAll(instructorStudents)}
                                                                folderInstructorId={instructorId}
                                                            />
                                                        </div>
                                                    </AdminDirectoryGroup>
                                                );
                                            })}
                                        </div>
                                    </DepartmentGroup>
                                );
                            })}
                        </div>
                    ) : (
                        // INSTRUCTOR VIEW: Standard Grouping
                        <>
                            <div>
                                {!isSuperAdmin && homeCollege && (
                                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
                                        My College ({homeCollege})
                                    </h2>
                                )}
                                <div className="space-y-6">
                                    {renderStudentGroups(filtered, true, departmentMap, homeDepts)}
                                </div>
                            </div>

                            {otherDepts.length > 0 && (
                                <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                                    <h2 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center">
                                        Other Departments
                                        <span className="ml-3 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] lowercase tracking-normal">
                                            {otherDepts.length} external
                                        </span>
                                    </h2>
                                    <div className="space-y-6">
                                        {renderStudentGroups(filtered, false, departmentMap, otherDepts)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
