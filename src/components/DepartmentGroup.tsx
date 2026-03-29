"use client";

import { useState } from "react";
import { Building2, ChevronRight, ChevronDown } from "lucide-react";

// ─── Color map for department badges ─────────────────────────────────────────
const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    BSIT: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
    BSCS: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
    BSEE: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    BSCE: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
    BSME: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    BSED: { bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
    BEED: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
    BSBA: { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
    BSA: { bg: "bg-pink-50 dark:bg-pink-900/20", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
};

const DEFAULT_COLOR = { bg: "bg-gray-50 dark:bg-gray-900/20", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-800" };

export function getDeptColor(dept: string) {
    return DEPT_COLORS[dept?.toUpperCase()] || DEFAULT_COLOR;
}

// ─── Department Badge (small pill) ───────────────────────────────────────────
export function DeptBadge({ department }: { department: string }) {
    if (!department) return null;
    const c = getDeptColor(department);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${c.bg} ${c.text} ${c.border}`}>
            {department}
        </span>
    );
}

// ─── Department Group (collapsible folder) ───────────────────────────────────
interface DepartmentGroupProps {
    department: string;
    count: number;
    children: React.ReactNode;
    defaultOpen?: boolean;
    itemLabel?: string;
}

export function DepartmentGroup({ department, count, children, defaultOpen = false, itemLabel = "items" }: DepartmentGroupProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const c = getDeptColor(department);

    return (
        <div className={`border rounded-xl overflow-hidden mb-4 shadow-sm ${c.border} bg-white dark:bg-gray-800`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            >
                <div className={`mr-4 p-2 rounded-lg ${c.bg}`}>
                    <Building2 className={`h-6 w-6 ${c.text}`} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{department}</h3>
                        <DeptBadge department={department} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{count} {itemLabel}</p>
                </div>
                {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
            </button>

            {isOpen && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
