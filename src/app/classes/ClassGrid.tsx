"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { DeleteClassButton } from "./DeleteClassButton";
import { MultiDeleteBar } from "@/components/MultiDeleteBar";
import { deleteClass } from "./actions";

interface ClassItem {
    id: string;
    name: string;
    description: string;
    year_level?: string;
    enrollments: { count: number }[];
}

interface ClassGridProps {
    classes: ClassItem[];
    isSuperAdmin: boolean;
}

export function ClassGrid({ classes, isSuperAdmin }: ClassGridProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        for (const id of Array.from(selected)) {
            await deleteClass(id);
        }
        setSelected(new Set());
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((c) => (
                    <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow relative ${selected.has(c.id) ? "border-nwu-red ring-2 ring-nwu-red/30" : "border-gray-100 dark:border-gray-700"}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                {!isSuperAdmin && (
                                    <input
                                        type="checkbox"
                                        checked={selected.has(c.id)}
                                        onChange={() => toggleSelect(c.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red cursor-pointer"
                                    />
                                )}
                                <div className="h-10 w-10 bg-nwu-red/10 rounded-lg flex items-center justify-center">
                                    <BookOpen className="h-5 w-5 text-nwu-red" />
                                </div>
                            </div>
                            {!isSuperAdmin && <DeleteClassButton id={c.id} />}
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{c.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">{c.description || "No description provided."}</p>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <Users className="h-4 w-4 mr-1" />
                                {c.enrollments?.[0]?.count || 0} Students
                            </div>
                            <Link
                                href={`/classes/${c.id}`}
                                className="text-sm font-medium text-nwu-red hover:underline"
                            >
                                {isSuperAdmin ? "View" : "Manage"} &rarr;
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {!isSuperAdmin && (
                <MultiDeleteBar
                    count={selected.size}
                    itemLabel={`class${selected.size !== 1 ? "es" : ""}`}
                    onDelete={handleBulkDelete}
                    onClear={() => setSelected(new Set())}
                />
            )}
        </>
    );
}
