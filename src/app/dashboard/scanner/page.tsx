"use client";

import { useState, useEffect, useCallback } from "react";
import { useSmartPolling } from "@/hooks/useSmartPolling";
import { format, parse } from "date-fns";
import { createClient } from "../../../utils/supabase/client";
import { useProfile } from "../../../context/ProfileContext";
import DashboardLayout from "../../../components/DashboardLayout";
import {
    QrCode, Loader2, CheckCircle2, XCircle, AlertTriangle,
    Radio, Users, Clock, X, ChevronDown
} from "lucide-react";

interface QrScan {
    id: string;
    student_id: number;
    status: string;
    scanned_at: string;
    students: { id: number; name: string; sin: string } | null;
}

interface QrClass {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    day_of_week: string;
    isSuspended?: boolean;
}

interface QrSession {
    id: string;
    class_id: string;
    action: string;
    status: string;
    created_at: string;
    expires_at: string;
    qr_payload: string;
    classes: { name: string } | null;
    scans: QrScan[];
}

export default function QRAttendancePage() {
    const { profile } = useProfile();
    const [classes, setClasses] = useState<QrClass[]>([]);
    const [classesLoading, setClassesLoading] = useState(true);
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [action, setAction] = useState<"check_in" | "check_out">("check_in");

    const [now, setNow] = useState(new Date());

    const [activeSessions, setActiveSessions] = useState<QrSession[]>([]);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);

    // Provide Manila Time Clock
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const manilaDayShort = now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short' });

    // Helper: Convert "HH:MM:SS" to minutes from midnight
    const getMinutes = (t: string | null) => {
        if (!t) return 0;
        const p = t.split(':').map(Number);
        return p[0] * 60 + p[1];
    };

    const currentManilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentMinutes = currentManilaTime.getHours() * 60 + currentManilaTime.getMinutes();

    // Day string for dependency tracking (only changes at midnight)
    const todayStrManila = format(now, "yyyy-MM-dd");

    // Load instructor's classes
    useEffect(() => {
        if (!profile) return;
        const supabase = createClient();
        setClassesLoading(true);
        const loadClassesAndOverrides = async () => {
            const { data: activeTerm } = await supabase
                .from("academic_terms")
                .select("id")
                .eq("is_active", true)
                .maybeSingle();

            let classesQuery = supabase
                .from("classes")
                .select("id, name, start_time, end_time, day_of_week, term_id")
                .eq("instructor_id", profile.id)
                .is("is_archived", false) // Also ignore archived classes
                .order("name");

            if (activeTerm) {
                // If there's an active term, STRICTLY show classes for that term
                classesQuery = classesQuery.eq("term_id", activeTerm.id);
            } else {
                // If NO term is active, show only classes that are NOT linked to any term (legacy)
                // This prevents showing ALL classes across all historical terms.
                classesQuery = classesQuery.is("term_id", null);
            }

            const [classesRes, overridesRes] = await Promise.all([
                classesQuery,
                supabase
                    .from("class_day_overrides")
                    .select("class_id, type")
                    .eq("date", todayStrManila)
            ]);
            
            const rawClasses = classesRes.data || [];
            const dayOverrides = overridesRes.data || [];
            
            // Filter by today's day of week
            const todayClasses = rawClasses
                .filter((c: QrClass) => (c.day_of_week || "").includes(manilaDayShort))
                .map((c: QrClass) => ({
                    ...c,
                    isSuspended: dayOverrides.some((o: { class_id: string }) => o.class_id === c.id)
                }));

            setClasses(todayClasses);
            
            // Stable selection: only select first if none selected
            if (todayClasses.length > 0 && !selectedClassId) {
                setSelectedClassId(todayClasses[0].id);
            }
            setClassesLoading(false);
        };
        loadClassesAndOverrides();
    }, [profile, manilaDayShort, todayStrManila, selectedClassId]);

    // Fetch active sessions
    const fetchSessions = useCallback(async () => {
        if (!profile) return;
        try {
            const res = await fetch(`/api/qr/session?instructor_id=${profile.id}`, { cache: "no-store" });
            const data = await res.json();
            setActiveSessions(data.sessions || []);
        } catch (err) {
            console.error("[QR] Fetch sessions error:", err);
        }
    }, [profile]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // 90s smart polling — stops when tab is hidden, resumes on focus
    useSmartPolling(fetchSessions, 90_000);

    // Generate QR image when session is active
    useEffect(() => {
        const activeSession = activeSessions[0];
        const payload = activeSession?.qr_payload;
        
        if (!payload) {
            setQrDataUrl(null);
            return;
        }

        let isMounted = true;
        
        async function generateQR() {
            try {
                const QRCode = (await import("qrcode")).default;
                const dataUrl = await QRCode.toDataURL(payload, {
                    width: 400,
                    margin: 2,
                    color: { dark: "#000000", light: "#ffffff" },
                    errorCorrectionLevel: "M",
                });
                if (isMounted) setQrDataUrl(dataUrl);
            } catch (err) {
                console.error("[QR] Failed to generate QR image:", err);
                if (isMounted) setError("Failed to render QR code component.");
            }
        }

        generateQR();
        return () => { isMounted = false; };
    }, [activeSessions]); // Still depends on activeSessions but now checks payload inside

    // Start a new session
    const startSession = async () => {
        if (!profile || !selectedClassId) return;
        
        const cls = classes.find(c => c.id === selectedClassId);
        if (cls) {
            const startM = getMinutes(cls.start_time);
            const endM = getMinutes(cls.end_time);

            if (cls.isSuspended) {
                setError(`Cannot start session: Class is suspended/no-class today.`);
                return;
            }

            if (action === 'check_in') {
                if (currentMinutes < (startM - 15)) {
                    const openDate = parse(cls.start_time, 'HH:mm:ss', new Date());
                    openDate.setMinutes(openDate.getMinutes() - 15);
                    setError(`Cannot start Time In early. Window opens at ${format(openDate, 'h:mm a')}.`);
                    return;
                }
                if (currentMinutes > endM) {
                    setError(`Cannot start Time In: Class session has already ended.`);
                    return;
                }
            } else {
                if (currentMinutes < (endM - 15)) {
                    const openDate = parse(cls.end_time, 'HH:mm:ss', new Date());
                    openDate.setMinutes(openDate.getMinutes() - 15);
                    setError(`Cannot start Time Out yet. Window opens 15 mins before class ends (${format(openDate, 'h:mm a')}).`);
                    return;
                }
                if (currentMinutes > (endM + 30)) {
                    setError(`Cannot start Time Out: The 30-minute grace period after class has ended.`);
                    return;
                }
            }
        }

        setStarting(true);
        setError(null);
 
        try {
            const res = await fetch("/api/qr/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    class_id: selectedClassId,
                    action,
                    instructor_id: profile.id,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to start session");
                return;
            }
            await fetchSessions();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setStarting(false);
        }
    };

    // End a session
    const endSession = async (sessionId: string) => {
        try {
            await fetch("/api/qr/session/approve", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId }),
            });
            await fetchSessions();
        } catch {
            setError("Failed to end session");
        }
    };

    // Approve all pending scans
    const approveAll = async (sessionId: string) => {
        setApproving(true);
        setSuccessMsg(null);
        try {
            const res = await fetch("/api/qr/session/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMsg(data.message || "Approved successfully!");
                setTimeout(() => setSuccessMsg(null), 4000);
            } else {
                setError(data.error || "Approval failed");
            }
            await fetchSessions();
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            alert("An error occurred: " + errorMsg);
        } finally {
            setApproving(false);
        }
    };

    // Reject all pending scans
    const rejectAll = async () => {
        const pendingIds = pendingScans.map(s => s.id);
        if (pendingIds.length === 0) return;

        try {
            await fetch("/api/qr/session/approve", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scan_ids: pendingIds }),
            });
            await fetchSessions();
        } catch {
            setError("Failed to reject all scans");
        }
    };

    // Reject individual scan
    const rejectScan = async (scanId: string) => {
        try {
            await fetch("/api/qr/session/approve", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scan_id: scanId }),
            });
            await fetchSessions();
        } catch {
            setError("Failed to reject scan");
        }
    };

    const activeSession = activeSessions[0] || null;
    const pendingScans = activeSession?.scans?.filter(s => s.status === "pending") || [];
    const approvedScans = activeSession?.scans?.filter(s => s.status === "approved") || [];
    const rejectedScans = activeSession?.scans?.filter(s => s.status === "rejected") || [];

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <QrCode className="h-6 w-6 text-nwu-red" />
                        QR Attendance
                    </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                            Project a QR code for students to scan. Approve their attendance in real time.
                        </p>
                    </div>
                {/* Error / Success Banners */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                )}
                {successMsg && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <p className="text-sm font-medium">{successMsg}</p>
                    </div>
                )}

                {/* ─── NO ACTIVE SESSION: Show Start Form ─── */}
                {!activeSession && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Radio className="h-5 w-5 text-nwu-red" />
                            Start a QR Session
                        </h2>

                        {/* Class Selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2">
                                Select Class
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    disabled={classesLoading}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-medium focus:ring-red-500 focus:border-red-500 appearance-none cursor-pointer"
                                >
                                    {classesLoading ? (
                                        <option>Loading classes...</option>
                                    ) : classes.length === 0 ? (
                                        <option>No classes scheduled for today</option>
                                    ) : (
                                        classes.map((c: QrClass) => {
                                            const startM = getMinutes(c.start_time);
                                            const endM = getMinutes(c.end_time);
                                            
                                            // Status check
                                            let statusLabel = "Closed";

                                            if (c.isSuspended) {
                                                statusLabel = "Closed (Suspended)";
                                            } else if (currentMinutes >= (startM - 15) && currentMinutes <= (startM + 30)) {
                                                statusLabel = "Time In available";
                                            } else if (currentMinutes >= (endM - 15) && currentMinutes <= (endM + 30)) {
                                                statusLabel = "Time Out available";
                                            } else if (currentMinutes > (startM + 30) && currentMinutes < (endM - 15)) {
                                                statusLabel = "Ongoing";
                                            } else if (currentMinutes < (startM - 15)) {
                                                const timeStr = format(parse(c.start_time, 'HH:mm:ss', new Date()), 'h:mm a');
                                                statusLabel = `Upcoming (${timeStr})`;
                                            } else if (currentMinutes > (endM + 30)) {
                                                statusLabel = "Closed (Class Ended)";
                                            }
                                            return (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} — {statusLabel}
                                                </option>
                                            );
                                        })
                                    )}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Action Selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2">
                                Attendance Type
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setAction("check_in")}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${action === "check_in"
                                        ? "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 shadow-inner"
                                        : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        }`}
                                >
                                    <span className="text-lg">↓</span> Time In
                                </button>
                                <button
                                    onClick={() => setAction("check_out")}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${action === "check_out"
                                        ? "bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 shadow-inner"
                                        : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        }`}
                                >
                                    <span className="text-lg">↑</span> Time Out
                                </button>
                            </div>
                        </div>

                        {/* Start Button */}
                        <button
                            onClick={startSession}
                            disabled={starting || !selectedClassId || classesLoading}
                            className="w-full py-4 bg-nwu-red hover:bg-red-800 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
                        >
                            {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                            {starting ? "Starting Session..." : "Start QR Session"}
                        </button>
                    </div>
                )}

                {/* ─── ACTIVE SESSION: Show QR + Inbox ─── */}
                {activeSession && (
                    <div className="space-y-6">
                        {/* Session Info Bar */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {(activeSession.classes as any)?.name || "Active Session"}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                        <span className={activeSession.action === "check_in" ? "text-green-600 dark:text-green-400 font-bold" : "text-orange-600 dark:text-orange-400 font-bold"}>
                                            {activeSession.action === "check_in" ? "⬇ TIME IN" : "⬆ TIME OUT"}
                                        </span>
                                        <span>•</span>
                                        <Clock className="h-3 w-3" />
                                        Expires {new Date(activeSession.expires_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => endSession(activeSession.id)}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all border border-gray-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-700"
                            >
                                End Session
                            </button>
                        </div>

                        {/* QR Code + Inbox Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* QR Code Display */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col items-center justify-center">
                                <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-4">
                                    Project This QR Code
                                </p>
                                {qrDataUrl ? (
                                    <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={qrDataUrl} alt="QR Attendance Code" className="w-64 h-64" />
                                    </div>
                                ) : (
                                    <div className="w-64 h-64 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
                                    Students scan this with their phone on the Student Portal
                                </p>
                            </div>

                            {/* Approval Inbox */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                        <Users className="h-4 w-4 text-nwu-red" />
                                        Scan Inbox
                                        {pendingScans.length > 0 && (
                                            <span className="bg-nwu-red text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                {pendingScans.length}
                                            </span>
                                        )}
                                    </h3>
                                    {pendingScans.length > 0 && (
                                        <button
                                            onClick={() => rejectAll()}
                                            className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 transition-colors"
                                        >
                                            Reject All
                                        </button>
                                    )}
                                </div>

                                {/* Pending Scans List */}
                                <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-1">
                                    {pendingScans.length === 0 && approvedScans.length === 0 && rejectedScans.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                                                <QrCode className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Waiting for students to scan...</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Scans will appear here in real time</p>
                                        </div>
                                    )}

                                    {/* Pending */}
                                    {pendingScans.map(scan => (
                                        <div
                                            key={scan.id}
                                            className="flex items-center justify-between px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 animate-in fade-in slide-in-from-left-2 duration-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center text-yellow-800 dark:text-yellow-200 text-xs font-bold">
                                                    {scan.students?.name?.charAt(0)?.toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{scan.students?.name || "Unknown"}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{scan.students?.sin || ""}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => rejectScan(scan.id)}
                                                className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 transition-colors"
                                                title="Reject"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Approved */}
                                    {approvedScans.map(scan => (
                                        <div
                                            key={scan.id}
                                            className="flex items-center justify-between px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 opacity-60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-green-800 dark:text-green-200 text-xs font-bold">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{scan.students?.name || "Unknown"}</p>
                                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Approved</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Rejected */}
                                    {rejectedScans.map(scan => (
                                        <div
                                            key={scan.id}
                                            className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 opacity-40"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center text-red-800 dark:text-red-200 text-xs font-bold">
                                                    <XCircle className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-through">{scan.students?.name || "Unknown"}</p>
                                                    <p className="text-xs text-red-500 dark:text-red-400 font-medium">Rejected</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Approve All Button */}
                                {pendingScans.length > 0 && (
                                    <button
                                        onClick={() => approveAll(activeSession.id)}
                                        disabled={approving}
                                        className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
                                    >
                                        {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        {approving ? "Approving..." : `✓ Approve All (${pendingScans.length})`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
