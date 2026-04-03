"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import Image from "next/image";

export function AdminDirectoryGroup({
    instructorName,
    instructorImageUrl,
    count,
    itemLabel,
    defaultOpen = false,
    children
}: {
    instructorId: string;
    instructorName: string;
    instructorImageUrl?: string | null;
    count: number;
    itemLabel: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-nwu-red/10 text-nwu-red flex items-center justify-center flex-shrink-0 overflow-hidden relative border border-gray-100 dark:border-gray-700">
                        {instructorImageUrl ? (
                            <Image
                                src={instructorImageUrl}
                                alt={instructorName}
                                fill
                                className="object-cover"
                            />
                        ) : instructorName === 'Unassigned' ? (
                            <User className="h-5 w-5" />
                        ) : (
                            <span className="font-bold text-sm">
                                {instructorName.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                            {instructorName}
                        </h3>
                        <p className="text-xs text-gray-500 font-medium tracking-wide">
                            {count} {itemLabel}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs font-semibold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 px-2.5 py-1 rounded-full text-gray-600 dark:text-gray-300">
                        {isOpen ? 'Close Folder' : 'Open Folder'}
                    </span>
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
            </button>

            {isOpen && (
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    {children}
                </div>
            )}
        </div>
    );
}
