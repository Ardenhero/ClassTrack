"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, Clock, AlertCircle, Ghost, TimerOff, LucideIcon, Radio } from "lucide-react";
import { useSmartPolling } from "@/hooks/useSmartPolling";

/** Row shape passed from the server component */
export interface AttendanceRow {
    id: string;
    studentId: string;
    date: string;
    studentName: string;
    studentSin: string;
    yearLevel: string;
    studentImageUrl?: string | null;
    className: string;
    timeIn: string;
    timeOut: string;
    status: string;
    statusLabel: string;
    badgeColor: string;
    iconName: string; // serialisable icon identifier
    adminNote?: string | null;
    noteBy?: string | null;
    noteAt?: string | null;
    entryMethod?: string | null;
}

/* ── icon resolver (can't pass React components through RSC → client boundary) ── */
const ICON_MAP: Record<string, LucideIcon> = {
    CheckCircle, Clock, AlertCircle, Ghost, TimerOff,
};
function resolveIcon(name: string): LucideIcon {
    return ICON_MAP[name] ?? CheckCircle;
}

/* ── status helpers (duplicated from server so we can grade live inserts) ── */
function getStatusBadge(status: string): { badgeColor: string; iconName: string } {
    switch (status) {
        case "Present":
            return { badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", iconName: "CheckCircle" };
        case "Manually Verified":
            return { badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", iconName: "CheckCircle" };
        case "Late":
            return { badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", iconName: "Clock" };
        case "Absent":
            return { badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", iconName: "AlertCircle" };
        default:
            return { badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400", iconName: "CheckCircle" };
    }
}

function fmtTime(ts: string | null): string {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
    });
}

/* ───────────────────── Component ───────────────────── */
interface Props {
    initialRows: AttendanceRow[];
    /** YYYY-MM-DD string of the day being viewed */
    dayString: string;
    instructorIds?: string[];
}


export default function LiveAttendanceTable({ initialRows, dayString, instructorIds }: Props) {
    const [rows, setRows] = useState<AttendanceRow[]>(initialRows);
    const [isLive, setIsLive] = useState(false);
    const [flash, setFlash] = useState<string | null>(null);

    // Keep rows in sync if server re-renders with new initialRows (e.g. filter change)
    useEffect(() => {
        setRows(initialRows);
    }, [initialRows]);

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("attendance-live")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "attendance_logs" },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async (payload: any) => {
                    const newRecord = payload.new;
                    const ts = newRecord.timestamp as string | null;

                    // Only add if the record belongs to the day we're viewing
                    if (ts) {
                        const recordDay = ts.substring(0, 10); // YYYY-MM-DD from ISO
                        // Compare with Manila-relative day
                        const recordManila = new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
                        if (recordManila !== dayString && recordDay !== dayString) return;
                    }

                    // Fetch the related student & class data
                    const { data: fullRecord } = await supabase
                        .from("attendance_logs")
                        .select(`
                    id, status, timestamp, time_out, entry_method,
                            classes ( name, instructor_id ),
                            students ( id, name, sin, year_level, image_url )
                        `)
                        .eq("id", newRecord.id as string)
                        .single();

                    if (!fullRecord) return;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rec = fullRecord as any;

                    // Support both object and array response for joined classes
                    const classData = Array.isArray(rec.classes) ? rec.classes[0] : rec.classes;

                    // Filter by instructor if needed
                    if (instructorIds && !classData) return;
                    const instructorId = classData?.instructor_id;
                    if (instructorIds && !instructorIds.includes(instructorId)) return;

                    const status = rec.status || "Present";
                    const { badgeColor, iconName } = getStatusBadge(status);

                    const newRow: AttendanceRow = {
                        id: rec.id,
                        studentId: rec.students?.id || "",
                        date: rec.timestamp,
                        studentName: rec.students?.name || "Unknown",
                        studentSin: rec.students?.sin || "-",
                        yearLevel: rec.students?.year_level || "",
                        studentImageUrl: rec.students?.image_url,
                        className: classData?.name || "Unknown",
                        timeIn: fmtTime(rec.timestamp),
                        timeOut: fmtTime(rec.time_out),
                        status,
                        statusLabel: status,
                        badgeColor,
                        iconName,
                        entryMethod: rec.entry_method || null,
                    };

                    setRows((prev) => [newRow, ...prev]);
                    setFlash(rec.id);
                    setTimeout(() => setFlash(null), 2000);

                    // Dispatch global scan event for notification provider
                    window.dispatchEvent(new CustomEvent('classtrack:scan', {
                        detail: {
                            studentName: newRow.studentName,
                            className: newRow.className,
                            status: newRow.status,
                            time: newRow.timeIn,
                        }
                    }));
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "attendance_logs" },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async (payload: any) => {
                    const updated = payload.new;

                    // Re-fetch to get joined data
                    const { data: fullRecord } = await supabase
                        .from("attendance_logs")
                        .select(`
                    id, status, timestamp, time_out, entry_method,
                            classes ( name, instructor_id ),
                            students ( id, name, sin, year_level, image_url )
                        `)
                        .eq("id", updated.id as string)
                        .single();

                    if (!fullRecord) return;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rec = fullRecord as any;

                    // Support both object and array response for joined classes
                    const classData = Array.isArray(rec.classes) ? rec.classes[0] : rec.classes;

                    // Filter by instructor if needed
                    if (instructorIds && !classData) return;
                    const instructorId = classData?.instructor_id;
                    if (instructorIds && !instructorIds.includes(instructorId)) return;

                    const status = rec.status || "Present";
                    const { badgeColor, iconName } = getStatusBadge(status);

                    setRows((prev) =>
                        prev.map((row) =>
                            row.id === rec.id
                                ? {
                                    ...row,
                                    timeOut: fmtTime(rec.time_out),
                                    studentImageUrl: rec.students?.image_url,
                                    status,
                                    statusLabel: status,
                                    badgeColor,
                                    iconName,
                                }
                                : row
                        )
                    );
                    setFlash(rec.id);
                    setTimeout(() => setFlash(null), 2000);
                }
            )
            .on(
                "postgres_changes",
                { event: "DELETE", schema: "public", table: "attendance_logs" },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (payload: any) => {
                    // payload.old contains the deleted record's old payload
                    if (payload.old && payload.old.id) {
                        const deletedId = payload.old.id;
                        setRows((prev) => prev.filter((row) => row.id !== deletedId));
                    }
                }
            )
            .subscribe((status: string, err?: Error) => {
                if (err) console.warn("Realtime subscription error:", err);
                setIsLive(status === "SUBSCRIBED");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dayString, instructorIds]);

    // Polling fallback: refresh attendance data every 90 seconds (visibility-aware)
    // This ensures updates appear even if Supabase Realtime isn't enabled
    const poll = useCallback(async () => {
        const supabase = createClient();
        const startOfDay = `${dayString}T00:00:00+08:00`;
        const endOfDay = `${dayString}T23:59:59+08:00`;

        let queryBuilder = supabase
            .from("attendance_logs")
            .select(`
                id, status, timestamp, time_out, entry_method,
                classes ( name, instructor_id ),
                students ( id, name, sin, year_level, image_url )
            `)
            .gte('timestamp', startOfDay)
            .lte('timestamp', endOfDay)
            .order('timestamp', { ascending: false })
            .limit(100);

        if (instructorIds) {
            queryBuilder = queryBuilder.in('classes.instructor_id', instructorIds);
        }

        const { data } = await queryBuilder;

        if (!data) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshRows: AttendanceRow[] = data.map((rec: any) => {
            const status = rec.status || "Present";
            const { badgeColor, iconName } = getStatusBadge(status);
            const classData = Array.isArray(rec.classes) ? rec.classes[0] : rec.classes;

            // Extra safety: skip if join failed but filter is active
            if (instructorIds && !classData) return null;
            return {
                id: rec.id,
                studentId: rec.students?.id || "",
                date: rec.timestamp,
                studentName: rec.students?.name || "Unknown",
                studentSin: rec.students?.sin || "-",
                yearLevel: rec.students?.year_level || "",
                studentImageUrl: rec.students?.image_url,
                className: classData?.name || "Unknown",
                timeIn: fmtTime(rec.timestamp),
                timeOut: fmtTime(rec.time_out),
                status,
                statusLabel: status,
                badgeColor,
                iconName,
                entryMethod: rec.entry_method || null,
            };
        }).filter(Boolean) as AttendanceRow[];

        setRows(prev => {
            // Only update if row count changed or any row differs
            if (prev.length !== freshRows.length) return freshRows;
            // Check if top row ID changed (new scan arrived)
            if (freshRows.length > 0 && prev[0]?.id !== freshRows[0]?.id) return freshRows;
            // Check for status changes
            const changed = freshRows.some((r, i) => prev[i]?.status !== r.status || prev[i]?.timeOut !== r.timeOut);
            return changed ? freshRows : prev;
        });
    }, [dayString, instructorIds]);

    // 90s smart polling — stops when tab is hidden, resumes on focus
    useSmartPolling(poll, 90_000);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <Radio className={`h-4 w-4 ${isLive ? "text-green-500 animate-pulse" : "text-gray-400"}`} />
                <span className={`text-xs font-medium ${isLive ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                    {isLive ? "Live — Listening for scans" : "Connecting..."}
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SIN</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time In</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time Out</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {rows.map((row, idx) => {
                            const Icon = resolveIcon(row.iconName);
                            const isNew = flash === row.id;
                            return (
                                <tr
                                    key={`${row.id}-${idx}`}
                                    className={`transition-all duration-500 ${isNew
                                        ? "bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-800"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                        }`}
                                    data-testid="attendance-record"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {format(parseISO(row.date), "MMM d, yyyy")}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                                        {row.studentSin || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-xs ring-1 ring-nwu-red/20 overflow-hidden relative">
                                                {row.studentImageUrl ? (
                                                    <Image
                                                        src={row.studentImageUrl}
                                                        alt={row.studentName}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    row.studentName[0]
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <Link 
                                                    href={`/students/${row.studentSin}`}
                                                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-nwu-red transition-all duration-200 block"
                                                >
                                                    {row.studentName}
                                                </Link>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{row.yearLevel}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        {row.className}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                                        {row.timeIn}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                                        {row.timeOut}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${row.badgeColor} w-fit`}>
                                                <Icon className="h-3 w-3 mr-1.5" />
                                                {row.statusLabel}
                                            </div>
                                            {row.entryMethod === 'auto-finalize' && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" title="Auto-marked absent by system">
                                                    Auto
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400 empty-state">
                        No logs found
                    </div>
                )}
            </div>
        </div>
    );
}
