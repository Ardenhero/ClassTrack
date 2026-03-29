"use client";

import { useState } from "react";
import { Folder, ChevronRight, ChevronDown, FolderOpen } from "lucide-react";

interface YearGroupProps {
    title: string;
    count: number;
    children: React.ReactNode;
    defaultOpen?: boolean;
    itemLabel?: string;
}

export function YearGroup({ title, count, children, defaultOpen = false, itemLabel = "items" }: YearGroupProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-6 shadow-sm bg-white dark:bg-gray-800">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center px-6 py-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
                <div className="mr-4 p-2 bg-nwu-red/10 rounded-lg text-nwu-red">
                    {isOpen ? <FolderOpen className="h-6 w-6" /> : <Folder className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{count} {itemLabel}</p>
                </div>
                {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
            </button>

            {isOpen && (
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
