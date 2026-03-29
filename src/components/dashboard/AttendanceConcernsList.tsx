"use client";

import { useState } from "react";
import { UserCheck } from "lucide-react";

interface AttendanceConcern {
    name: string;
    className: string;
    absent: number;
}

interface AttendanceConcernsListProps {
    attendanceConcerns: AttendanceConcern[];
}

export function AttendanceConcernsList({ attendanceConcerns }: AttendanceConcernsListProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (attendanceConcerns.length === 0) {
        return (
            <div className="text-center py-10">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">All students are in good standing</p>
                <p className="text-xs text-gray-400 mt-1">No major absences detected recently</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex-1 space-y-2">
                {(isExpanded ? attendanceConcerns : attendanceConcerns.slice(0, 5)).map((student, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-all group">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-nwu-red/10 text-nwu-red flex items-center justify-center font-bold text-xs">
                                {idx + 1}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{student.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate uppercase tracking-wider">{student.className}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <div className="text-sm font-black text-red-600 dark:text-red-400">{student.absent}</div>
                                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">ABSENCES</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {attendanceConcerns.length > 5 && (
                <div className="mt-auto">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-center p-2 mt-4 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors border border-dashed border-gray-200 dark:border-gray-700 rounded-xl uppercase tracking-widest"
                        aria-label={isExpanded ? "Show fewer concerns" : "Show all attendance concerns"}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? "SHOW LESS" : `SHOW ALL (${attendanceConcerns.length})`}
                    </button>
                </div>
            )}
        </div>
    );
}
