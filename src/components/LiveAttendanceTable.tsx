"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import { CheckCircle, Clock, AlertCircle, Ghost, TimerOff, LucideIcon, Radio } from "lucide-react";

/** Row shape passed from the server component */
export interface AttendanceRow {
    id: string;
    studentId: string;
    date: string;
    studentName: string;
    studentSin: string;
    yearLevel: string;
    className: string;
    timeIn: string;
    timeOut: string;
    status: string;
    statusLabel: string;
    badgeColor: string;
    iconName: string; // serialisable icon identifier
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
}

export default function LiveAttendanceTable({ initialRows, dayString }: Props) {
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
                            id, status, timestamp, time_out,
                            classes ( name ),
                            students ( id, name, sin, year_level )
                        `)
                        .eq("id", newRecord.id as string)
                        .single();

                    if (!fullRecord) return;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rec = fullRecord as any;
                    const status = rec.status || "Present";
                    const { badgeColor, iconName } = getStatusBadge(status);

                    const newRow: AttendanceRow = {
                        id: rec.id,
                        studentId: rec.students?.id || "",
                        date: rec.timestamp,
                        studentName: rec.students?.name || "Unknown",
                        studentSin: rec.students?.sin || "-",
                        yearLevel: rec.students?.year_level || "",
                        className: rec.classes?.name || "Unknown",
                        timeIn: fmtTime(rec.timestamp),
                        timeOut: fmtTime(rec.time_out),
                        status,
                        statusLabel: status,
                        badgeColor,
                        iconName,
                    };

                    setRows((prev) => [newRow, ...prev]);
                    setFlash(rec.id);
                    setTimeout(() => setFlash(null), 2000);
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
                            id, status, timestamp, time_out,
                            classes ( name ),
                            students ( id, name, sin, year_level )
                        `)
                        .eq("id", updated.id as string)
                        .single();

                    if (!fullRecord) return;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rec = fullRecord as any;
                    const status = rec.status || "Present";
                    const { badgeColor, iconName } = getStatusBadge(status);

                    setRows((prev) =>
                        prev.map((row) =>
                            row.id === rec.id
                                ? {
                                    ...row,
                                    timeOut: fmtTime(rec.time_out),
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
            .subscribe((status: string) => {
                setIsLive(status === "SUBSCRIBED");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dayString]);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <Radio className={`h-4 w-4 ${isLive ? "text-green-500 animate-pulse" : "text-gray-400"}`} />
                <span className={`text-xs font-medium ${isLive ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                    {isLive ? "Live — Listening for scans" : "Connecting..."}
                </span>
            </div>

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
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-nwu-red/10 flex items-center justify-center text-nwu-red font-bold text-xs ring-1 ring-nwu-red/20">
                                            {row.studentName[0]}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{row.studentName}</div>
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
                                    <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${row.badgeColor} w-fit`}>
                                        <Icon className="h-3 w-3 mr-1.5" />
                                        {row.statusLabel}
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
    );
}
