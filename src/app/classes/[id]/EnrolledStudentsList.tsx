"use client";

import { useState } from "react";
import { Users, Search, TrendingDown, Printer } from "lucide-react";
import { UnenrollButton } from "./UnenrollButton";
import StatusOverrideButton from "./StatusOverrideButton";

interface StudentRowData {
    enrollmentId: string;
    studentId: string;
    studentName: string;
    yearLevel: string;
    statusLabel: string;
    badgeColor: string;
    iconName: string;
    timeIn: string;
    timeOut: string;
    // All-time stats
    allTimeSessions: number;
    allTimePresent: number;
    allTimeLate: number;
    allTimeAbsent: number;
    allTimeExcused: number;
    attendanceRate: number;
}

interface EnrolledStudentsListProps {
    students: StudentRowData[];
    classId: string;
    className_: string;
    dayString: string;
    displayDate: string;
    isInstructor: boolean;
}


export default function EnrolledStudentsList({
    students,
    classId,
    className_,
    dayString,
    displayDate,
    isInstructor,
}: EnrolledStudentsListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "attendance">("name");

    const filtered = students
        .filter(s => s.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === "attendance") return a.attendanceRate - b.attendanceRate; // worst first
            return a.studentName.localeCompare(b.studentName);
        });

    const getAttendanceBadge = (rate: number) => {
        if (rate >= 85) return { color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400", label: "Good" };
        if (rate >= 70) return { color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400", label: "Warning" };
        return { color: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400", label: "Critical" };
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden print:shadow-none print:border-0">
            {/* Header with search and sort */}
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 print:border-b-2 print:border-black">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center">
                        <Users className="h-5 w-5 text-gray-400 mr-2" />
                        <h3 className="font-bold text-gray-900 dark:text-white">{displayDate}</h3>
                        <span className="ml-2 text-xs text-gray-400 font-medium">({filtered.length} students)</span>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search students..."
                                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red/20 w-44"
                            />
                        </div>
                        {/* Sort toggle */}
                        <button
                            onClick={() => setSortBy(sortBy === "name" ? "attendance" : "name")}
                            className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-colors flex items-center gap-1 ${sortBy === "attendance"
                                ? "text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                : "text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700"
                                }`}
                            title="Sort by attendance (worst first)"
                        >
                            <TrendingDown className="h-3 w-3" />
                            {sortBy === "attendance" ? "At Risk First" : "A-Z"}
                        </button>
                        {/* Print */}
                        <button
                            onClick={handlePrint}
                            className="px-2.5 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700"
                            title="Print attendance"
                        >
                            <Printer className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Student rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((student) => {
                    const badge = getAttendanceBadge(student.attendanceRate);
                    return (
                        <div key={student.enrollmentId} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-3 print:py-2">
                            {/* Student info + attendance % */}
                            <div className="flex items-center min-w-0">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold mr-3 print:h-8 print:w-8">
                                    {student.studentName[0]}
                                </div>
                                <div className="min-w-0 mr-3">
                                    <p className="font-medium text-gray-900 dark:text-white truncate text-sm">{student.studentName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.yearLevel}</p>
                                </div>
                                {/* All-time attendance badge */}
                                {student.allTimeSessions > 0 && (
                                    <div className={`hidden sm:flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.color}`} title={`${student.allTimePresent + student.allTimeLate}/${student.allTimeSessions} sessions attended`}>
                                        {student.attendanceRate.toFixed(0)}%
                                    </div>
                                )}
                            </div>

                            {/* Today's attendance */}
                            <div className="flex items-center space-x-4 text-sm">
                                <div className="flex space-x-6 mr-2">
                                    <div className="text-center w-20">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 block print:text-[8px]">Time In</span>
                                        <div className="bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded text-gray-900 dark:text-gray-100 font-mono text-xs">
                                            {student.timeIn}
                                        </div>
                                    </div>
                                    <div className="text-center w-20">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 block print:text-[8px]">Time Out</span>
                                        <div className="bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded text-gray-900 dark:text-gray-100 font-mono text-xs">
                                            {student.timeOut}
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${student.badgeColor} min-w-[90px] justify-center`}>
                                    {student.statusLabel}
                                </div>

                                {/* Unenroll + Override (instructor only, hidden on print) */}
                                <div className="flex items-center gap-1 print:hidden">
                                    {isInstructor && (
                                        <UnenrollButton
                                            classId={classId}
                                            studentId={student.studentId}
                                            studentName={student.studentName}
                                            className_={className_}
                                        />
                                    )}
                                    {isInstructor && (
                                        <StatusOverrideButton
                                            studentId={student.studentId}
                                            classId={classId}
                                            date={dayString}
                                            currentStatus={student.statusLabel}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && students.length > 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No students matching &ldquo;{searchQuery}&rdquo;
                    </div>
                )}

                {students.length === 0 && (
                    <div className="p-12 text-center text-gray-500">
                        No students enrolled yet.
                    </div>
                )}
            </div>
        </div>
    );
}
