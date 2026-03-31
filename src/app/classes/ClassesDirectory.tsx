"use client";

import { useState, useMemo } from "react";

import { YearGroup } from "../../components/YearGroup";
import { ClassGrid } from "./ClassGrid";
import { BookOpen } from "lucide-react";
import { AdminDirectoryGroup } from "../../components/admin/AdminDirectoryGroup";
import { DepartmentGroup, getDeptColor } from "../../components/DepartmentGroup";
import type { Department } from "@/lib/departments";

interface ClassItem {
    id: string;
    name: string;
    description: string;
    year_level?: string;
    department?: string;
    schedule_days?: string;
    start_time?: string;
    end_time?: string;
    instructor_id: string;
    instructors?: { id: string; name: string; image_url: string | null; departments?: { name: string; code: string } | null };
    enrollments: { count: number }[];
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export function ClassesDirectory({
    classes,
    departments,
    isSuperAdmin,
    isActiveAdmin,
    isReadOnly = false,
    profileId,
    initialInstructorId,
}: {
    classes: ClassItem[];
    departments: Department[];
    isSuperAdmin: boolean;
    isActiveAdmin: boolean;
    isReadOnly: boolean;
    profileId?: string;
    initialInstructorId?: string;
}) {
    const [activeYear, setActiveYear] = useState("");
    const [activeDept, setActiveDept] = useState("");

    // INSTANT client-side filtering — zero server round-trips
    const filtered = useMemo(() => {
        let result = classes;
        if (activeDept) {
            result = result.filter(c => c.instructors?.departments?.code === activeDept);
        }
        if (activeYear) {
            result = result.filter(c => c.year_level === activeYear);
        }
        return result;
    }, [classes, activeDept, activeYear]);

    const toggleYear = (year: string) => setActiveYear(prev => prev === year ? "" : year);

    // Render helper for the inner department/year grouping
    const renderYearGroups = (classList: ClassItem[]) => {
        const yearGrouped = YEAR_LEVELS.reduce((acc, level) => {
            const items = classList.filter(c => c.year_level === level);
            if (items.length > 0) acc[level] = items;
            return acc;
        }, {} as Record<string, ClassItem[]>);

        const otherClasses = classList.filter(c => !YEAR_LEVELS.includes(c.year_level || ""));
        if (otherClasses.length > 0) yearGrouped["Other"] = otherClasses;

        return Object.entries(yearGrouped).map(([level, items]) => (
            <YearGroup key={level} title={level} count={items.length} itemLabel="classes">
                <ClassGrid classes={items} isSuperAdmin={isSuperAdmin} isAdmin={isActiveAdmin} isReadOnly={isReadOnly} profileId={profileId} />
            </YearGroup>
        ));
    };

    // If Admin, group by instructor first
    const adminGroups = useMemo(() => {
        if (!isActiveAdmin) return [];
        const map = new Map<string, ClassItem[]>();
        filtered.forEach(c => {
            if (!map.has(c.instructor_id)) map.set(c.instructor_id, []);
            map.get(c.instructor_id)!.push(c);
        });
        return Array.from(map.entries()).sort((a, b) => {
            const nameA = a[1][0]?.instructors?.name || "Unassigned";
            const nameB = b[1][0]?.instructors?.name || "Unassigned";
            return nameA.localeCompare(nameB);
        });
    }, [filtered, isActiveAdmin]);

    // Super Admin: Group by Department -> Instructor
    const superAdminGroups = useMemo(() => {
        if (!isSuperAdmin) return new Map<string, Map<string, ClassItem[]>>();
        const deptMap = new Map<string, Map<string, ClassItem[]>>();

        filtered.forEach(c => {
            const dept = c.instructors?.departments?.code || "Unassigned";
            if (!deptMap.has(dept)) deptMap.set(dept, new Map());

            const instMap = deptMap.get(dept)!;
            const instId = c.instructor_id || "unassigned";
            if (!instMap.has(instId)) instMap.set(instId, []);
            instMap.get(instId)!.push(c);
        });

        return deptMap;
    }, [filtered, isSuperAdmin]);

    return (
        <>
            {/* Inline Filter Chips — instant, no navigation */}
            <div className="mb-6 space-y-3">
                {isSuperAdmin && departments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-center mr-1">Dept:</span>
                        {departments.map(dept => {
                            const isActive = activeDept === dept.code;
                            const c = getDeptColor(dept.code);
                            return (
                                <button
                                    key={dept.id}
                                    onClick={() => setActiveDept(prev => prev === dept.code ? "" : dept.code)}
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
                )}

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

            {/* Grouped Content */}
            <div className="space-y-8">
                {isActiveAdmin && !isSuperAdmin ? (
                    // ADMIN VIEW: Folders per Instructor (Alphabetical)
                    <div className="space-y-2">
                        {adminGroups.map(([instructorId, instructorClasses], index) => {
                            const instName = instructorClasses[0]?.instructors?.name || "Unassigned";

                            return (
                                <AdminDirectoryGroup
                                    key={instructorId}
                                    instructorId={instructorId}
                                    instructorName={instName}
                                    instructorImageUrl={instructorClasses[0]?.instructors?.image_url}
                                    count={instructorClasses.length}
                                    itemLabel="classes"
                                    defaultOpen={initialInstructorId ? instructorId === initialInstructorId : index === 0}
                                >
                                    <div className="pt-2 pb-4 px-2">
                                        <ClassGrid classes={instructorClasses} isSuperAdmin={isSuperAdmin} isAdmin={isActiveAdmin} isReadOnly={isReadOnly} profileId={profileId} />
                                    </div>
                                </AdminDirectoryGroup>
                            );
                        })}
                    </div>
                ) : isSuperAdmin ? (
                    // SUPER ADMIN VIEW: Department -> Instructor Folders
                    <div className="space-y-6">
                        {Array.from(superAdminGroups.entries()).map(([dept, instMap], deptIndex) => {
                            const instructorEntries = Array.from(instMap.entries()).sort((a, b) => {
                                const nameA = a[1][0]?.instructors?.name || "Unassigned";
                                const nameB = b[1][0]?.instructors?.name || "Unassigned";
                                return nameA.localeCompare(nameB);
                            });

                            let totalDeptClasses = 0;
                            instructorEntries.forEach(([, classesList]) => totalDeptClasses += classesList.length);

                            return (
                                <DepartmentGroup key={dept} department={dept} count={totalDeptClasses} itemLabel="classes" defaultOpen={superAdminGroups.size === 1 || deptIndex === 0}>
                                    <div className="space-y-2 pb-2">
                                        {instructorEntries.map(([instructorId, instructorClasses]) => {
                                            const instName = instructorClasses[0]?.instructors?.name || "Unassigned";
                                            return (
                                                <AdminDirectoryGroup
                                                    key={instructorId}
                                                    instructorId={instructorId}
                                                    instructorName={instName}
                                                    instructorImageUrl={instructorClasses[0]?.instructors?.image_url}
                                                    count={instructorClasses.length}
                                                    itemLabel="classes"
                                                    defaultOpen={initialInstructorId ? instructorId === initialInstructorId : undefined}
                                                >
                                                    <div className="pt-2 pb-4 px-2">
                                                        <ClassGrid classes={instructorClasses} isSuperAdmin={isSuperAdmin} isAdmin={isActiveAdmin} isReadOnly={isReadOnly} profileId={profileId} />
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
                    // INSTRUCTOR VIEW: Standard Grouping by Year
                    <div className="space-y-6">
                        {renderYearGroups(filtered)}
                    </div>
                )}
            </div>

            {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No matching classes found</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">Try adjusting your filters.</p>
                </div>
            )}
        </>
    );
}
