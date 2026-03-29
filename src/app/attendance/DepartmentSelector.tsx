"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";

interface Department {
    id: string;
    name: string;
    code: string;
}

export function DepartmentSelector({ departments, currentDeptId }: { departments: Department[], currentDeptId?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleHide = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (id === "all") {
            params.delete("deptId");
        } else {
            params.set("deptId", id);
        }
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="relative group w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-4 w-4 text-gray-400 group-focus-within:text-nwu-red transition-colors" />
            </div>
            <select
                value={currentDeptId || "all"}
                onChange={(e) => handleHide(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 text-sm border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red transition-all appearance-none outline-none"
            >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                    </option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
}
