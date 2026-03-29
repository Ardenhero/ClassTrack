"use client";

import { useState } from "react";
import { MoreHorizontal, Edit, Archive } from "lucide-react";

interface ClassData {
    id: string;
    name: string;
    description: string;
    start_time?: string;
    end_time?: string;
    year_level?: string;
    schedule_days?: string;
    room_id?: string | null;
}

export function ClassCardActions({ onEdit, onArchive }: { classData: ClassData | null, onEdit: () => void, onArchive: () => void }) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="relative inline-block text-left">
            <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                onClick={(e) => {
                    e.preventDefault();
                    setMenuOpen(!menuOpen);
                }}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpen(false);
                        }}
                    />
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setMenuOpen(false);
                                    onEdit();
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600/50"
                            >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Class
                            </button>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setMenuOpen(false);
                                    onArchive();
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive Class
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
