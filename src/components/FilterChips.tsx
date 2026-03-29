"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getDeptColor } from "./DepartmentGroup";
import { getActiveDepartments, type Department } from "@/lib/departments";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export function FilterChips({ profileId }: { profileId?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [departments, setDepartments] = useState<Department[]>([]);

    useEffect(() => {
        getActiveDepartments(profileId).then(setDepartments);
    }, [profileId]);

    const activeDept = searchParams.get("dept") || "";
    const activeYear = searchParams.get("year") || "";

    const setFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (params.get(key) === value) {
            params.delete(key); // Toggle off
        } else {
            params.set(key, value);
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="mb-6 space-y-3">
            {/* Department chips */}
            <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-center mr-1">Dept:</span>
                {departments.map((dept) => {
                    const isActive = activeDept === dept.code;
                    const c = getDeptColor(dept.code);
                    return (
                        <button
                            key={dept.id}
                            onClick={() => setFilter("dept", dept.code)}
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

            {/* Year level chips */}
            <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-center mr-1">Year:</span>
                {YEAR_LEVELS.map((year) => {
                    const isActive = activeYear === year;
                    return (
                        <button
                            key={year}
                            onClick={() => setFilter("year", year)}
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
    );
}
