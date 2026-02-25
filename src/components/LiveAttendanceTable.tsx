"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO } from "date-fns";
import { CheckCircle, Clock, AlertCircle, Ghost, TimerOff, LucideIcon, Radio, Snowflake, MessageSquare, X } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";

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
    adminNote?: string | null;
    noteBy?: string | null;
    noteAt?: string | null;
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
}

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
function isFrozen(dateStr: string): boolean {
    return (Date.now() - new Date(dateStr).getTime()) > FORTY_EIGHT_HOURS;
}

export default function LiveAttendanceTable({ initialRows, dayString }: Props) {
    const [rows, setRows] = useState<AttendanceRow[]>(initialRows);
    const [isLive, setIsLive] = useState(false);
    const [flash, setFlash] = useState<string | null>(null);
    const [noteModal, setNoteModal] = useState<{ rowId: string; studentName: string; status: string } | null>(null);
    const [noteText, setNoteText] = useState("");
    const [saving, setSaving] = useState(false);
    const { profile } = useProfile();
    const isAdmin = profile?.role === "admin" || profile?.is_super_admin;

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
            .subscribe((status: string) => {
                setIsLive(status === "SUBSCRIBED");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dayString]);

    /** Add note to attendance record */
    const handleAddNote = async () => {
        if (!noteModal || !noteText.trim()) return;
        setSaving(true);
        const supabase = createClient();

        const row = rows.find(r => r.id === noteModal.rowId);
        const frozen = row ? isFrozen(row.date) : false;

        // Instructors cannot edit frozen records
        if (frozen && !isAdmin) {
            setSaving(false);
            return;
        }

        // For instructors: if status is Absent, auto-change to "Manually Verified"
        const newStatus = (!isAdmin && noteModal.status === "Absent") ? "Manually Verified" : undefined;

        const updateData: Record<string, unknown> = {
            admin_note: noteText.trim(),
            note_by: profile?.id,
            note_at: new Date().toISOString(),
        };
        if (newStatus) {
            updateData.status = newStatus;
        }

        const { error } = await supabase
            .from("attendance_logs")
            .update(updateData)
            .eq("id", noteModal.rowId);

        if (!error) {
            // Update local state
            setRows(prev => prev.map(r => {
                if (r.id !== noteModal.rowId) return r;
                const updatedStatus = newStatus || r.status;
                const { badgeColor, iconName } = getStatusBadge(updatedStatus);
                return {
                    ...r,
                    adminNote: noteText.trim(),
                    status: updatedStatus,
                    statusLabel: updatedStatus,
                    badgeColor,
                    iconName,
                };
            }));

            // Audit log — human-readable
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const studentName = noteModal.studentName;
                const description = newStatus
                    ? `Instructor marked ${studentName} as "Manually Verified" (was Absent). Note: "${noteText.trim()}"`
                    : `Note added to ${studentName}'s attendance record: "${noteText.trim()}"`;

                await supabase.from("audit_logs").insert({
                    action: newStatus ? "attendance_manually_verified" : "attendance_note_added",
                    entity_type: "attendance_log",
                    entity_id: noteModal.rowId,
                    details: description,
                    performed_by: user.id,
                });
            }
        }

        setSaving(false);
        setNoteModal(null);
        setNoteText("");
    };

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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Note</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {rows.map((row, idx) => {
                            const Icon = resolveIcon(row.iconName);
                            const isNew = flash === row.id;
                            const frozen = isFrozen(row.date);
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
                                        <div className="flex items-center gap-2">
                                            <div className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${row.badgeColor} w-fit`}>
                                                <Icon className="h-3 w-3 mr-1.5" />
                                                {row.statusLabel}
                                            </div>
                                            {frozen && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 font-bold" title="Record frozen (>48h)">
                                                    <Snowflake className="h-3 w-3" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {row.adminNote ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md max-w-[150px] truncate" title={row.adminNote}>
                                                    <MessageSquare className="h-3 w-3 shrink-0" />
                                                    {row.adminNote}
                                                </span>
                                            ) : null}
                                            {/* Add Note button — disabled if frozen for instructors */}
                                            {(!frozen || isAdmin) && (
                                                <button
                                                    onClick={() => setNoteModal({ rowId: row.id, studentName: row.studentName, status: row.status })}
                                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-nwu-red transition-colors"
                                                    title={isAdmin && frozen ? "Defrost: Add admin note" : "Add note"}
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                </button>
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

            {/* Add Note Modal */}
            {noteModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Note</h3>
                                <p className="text-xs text-gray-500 mt-0.5">For {noteModal.studentName}</p>
                            </div>
                            <button onClick={() => { setNoteModal(null); setNoteText(""); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {!isAdmin && noteModal.status === "Absent" && (
                            <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700 font-medium">
                                🟣 Adding a note will mark this record as <strong>&ldquo;Manually Verified&rdquo;</strong> — distinguishing it from biometric scans.
                            </div>
                        )}

                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="e.g. Student was late due to medical appointment"
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/10 focus:border-nwu-red outline-none transition-all dark:bg-gray-900 text-sm resize-none"
                            autoFocus
                        />

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => { setNoteModal(null); setNoteText(""); }}
                                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddNote}
                                disabled={!noteText.trim() || saving}
                                className="flex-1 py-2.5 text-sm font-bold text-white bg-nwu-red hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Note"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
