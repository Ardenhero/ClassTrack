"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QrCode, Clock, AlertTriangle, Loader2, Search, ShieldCheck, FileText, Activity, X } from "lucide-react";
import { SubmitEvidenceContent } from "@/components/SubmitEvidenceContent";

// Types for Attendance Data
interface ClassStat {
    id: number;
    subject_name: string;
    section: string;
    year_level: string;
    present: number;
    late: number;
    absent: number;
    excuse_pending: number;
    total: number;
    percentage: number;
}

interface OverallStat {
    total: number;
    present: number;
    late: number;
    absent: number;
    excuse_pending: number;
    percentage: number;
}

function StudentAttendance({ sin }: { sin: string }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ overall: OverallStat | null, classes: ClassStat[] }>({ overall: null, classes: [] });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                const res = await fetch(`/api/student/attendance?sin=${encodeURIComponent(sin)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load attendance");

                setStats({ overall: data.overall_stats, classes: data.class_stats });
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("Unknown error occurred");
                }
            } finally {
                setLoading(false);
            }
        };

        if (sin) fetchAttendance();
    }, [sin]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4 glass-card rounded-2xl">
                <Loader2 className="h-8 w-8 text-nu-400 shadow-[0_0_15px_rgba(176,42,42,0.6)] animate-spin rounded-full" />
                <p className="text-sm text-gray-400 font-medium tracking-wide">Loading your records...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl flex items-start gap-4 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)]">
                <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 drop-shadow-md" />
                <div>
                    <h3 className="font-bold mb-1 tracking-wide">Could not load attendance</h3>
                    <p className="text-sm opacity-90">{error}</p>
                </div>
            </div>
        );
    }

    const ov = stats.overall;

    return (
        <div className="space-y-6">
            {/* Overall Stats Card */}
            {ov && (
                <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nu-500/50 to-transparent"></div>
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                        <Activity className="h-32 w-32 text-nu-400" />
                    </div>

                    <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-6">Overall Attendance Summary</h3>

                    <div className="flex items-center gap-6 mb-6">
                        <div className="relative h-24 w-24 rounded-full flex items-center justify-center bg-dark-bg border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90 filter drop-shadow-[0_0_8px_currentColor]">
                                <circle cx="44" cy="44" r="40" className="stroke-white/5" strokeWidth="8" fill="none" />
                                <circle
                                    cx="44" cy="44" r="40"
                                    className={`stroke-current ${ov.percentage >= 80 ? 'text-green-500' : ov.percentage >= 60 ? 'text-yellow-500' : 'text-nu-500'}`}
                                    strokeWidth="8"
                                    fill="none"
                                    strokeDasharray="251.2"
                                    strokeDashoffset={251.2 - (251.2 * ov.percentage) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="text-2xl font-black text-white tracking-tighter drop-shadow-md">{ov.percentage}%</span>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-2">
                            <div className="bg-dark-surface/50 p-2 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Present</p>
                                <p className="text-xl font-black text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">{ov.present}</p>
                            </div>
                            <div className="bg-dark-surface/50 p-2 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Late</p>
                                <p className="text-xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">{ov.late}</p>
                            </div>
                            <div className="bg-dark-surface/50 p-2 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Absent</p>
                                <p className="text-xl font-black text-nu-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]">{ov.absent}</p>
                            </div>
                            <div className="bg-dark-surface/50 p-2 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Excused</p>
                                <p className="text-xl font-black text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]">{ov.excuse_pending}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Per Class Breakdown */}
            <div>
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-4 px-2">Per-Class Breakdown</h3>

                {stats.classes.length === 0 ? (
                    <p className="text-sm text-gray-500 italic p-6 text-center glass-panel rounded-xl">No classes found.</p>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {stats.classes.map(cls => (
                            <div key={cls.id} className="glass-panel rounded-xl p-4 shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all group border border-transparent hover:border-white/10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="font-bold text-white leading-tight group-hover:text-nu-300 transition-colors">{cls.subject_name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{cls.section} • <span className="text-nu-400/80">{cls.year_level}</span></p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black tracking-wider ${cls.percentage >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_8px_rgba(74,222,128,0.2)]' : cls.percentage >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_8px_rgba(250,204,21,0.2)]' : 'bg-red-500/10 text-nu-400 border border-red-500/20 shadow-[0_0_8px_rgba(248,113,113,0.2)]'}`}>
                                        {cls.percentage}%
                                    </span>
                                </div>

                                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <div className="bg-green-500/5 rounded-lg p-2 border border-green-500/10 hover:bg-green-500/10 transition-colors">
                                        <p className="text-green-400 font-bold text-sm tracking-wide">{cls.present}</p>
                                        <p className="text-green-500/70 text-[9px] font-bold uppercase tracking-widest mt-0.5">Present</p>
                                    </div>
                                    <div className="bg-yellow-500/5 rounded-lg p-2 border border-yellow-500/10 hover:bg-yellow-500/10 transition-colors">
                                        <p className="text-yellow-400 font-bold text-sm tracking-wide">{cls.late}</p>
                                        <p className="text-yellow-500/70 text-[9px] font-bold uppercase tracking-widest mt-0.5">Late</p>
                                    </div>
                                    <div className="bg-red-500/5 rounded-lg p-2 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                                        <p className="text-nu-400 font-bold text-sm tracking-wide">{cls.absent}</p>
                                        <p className="text-nu-400/70 text-[9px] font-bold uppercase tracking-widest mt-0.5">Absent</p>
                                    </div>
                                    <div className="bg-blue-500/5 rounded-lg p-2 border border-blue-500/10 hover:bg-blue-500/10 transition-colors">
                                        <p className="text-blue-400 font-bold text-sm tracking-wide">{cls.excuse_pending}</p>
                                        <p className="text-blue-500/70 text-[9px] font-bold uppercase tracking-widest mt-0.5">Excused</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Student Portal — PWA-ready page for QR fallback attendance
export default function StudentPortalPage() {
    const [sin, setSin] = useState("");
    const [step, setStep] = useState<"login" | "dashboard">("login");
    const [activeTab, setActiveTab] = useState<"qr" | "attendance" | "excuse">("qr");
    const [student, setStudent] = useState<{ id: number; name: string } | null>(null);
    const [classes, setClasses] = useState<{ id: string; name: string; room_id: string | null; room_name: string | null; start_time: string; end_time: string }[]>([]);

    // QR Generator State
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [action, setAction] = useState<"check_in" | "check_out" | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [qrStep, setQrStep] = useState<"select" | "action" | "generating" | "qr">("select");
    const [countdown, setCountdown] = useState(60);
    const generationCountsRef = useRef<Record<string, number>>({});
    const [, forceRender] = useState(0);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Countdown timer for QR expiration
    useEffect(() => {
        if (qrStep !== "qr") return;
        if (countdown <= 0) {
            setQrStep("select");
            setQrDataUrl(null);
            setCountdown(60);
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [qrStep, countdown]);

    // Step 1: Look up student by SIN (Dashboard Login)
    const lookupStudent = async () => {
        if (!sin.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/qr/student-lookup?sin=${encodeURIComponent(sin.trim())}`);
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || "Student not found. Check your ID number.");
                return;
            }
            setStudent(data.student);
            setClasses(data.classes);
            setStep("dashboard");
            setActiveTab("qr");
        } catch {
            setError("Network error. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Generate QR code
    const generateQR = useCallback(async (classId: string, roomId: string, actionParam: string) => {
        if (!student) return;

        // Check generation limit
        const countKey = `${classId}:${actionParam}`;
        const currentCount = generationCountsRef.current[countKey] || 0;
        if (currentCount >= 3) {
            setError(`You have used all 3 QR generations for ${actionParam === 'check_in' ? 'Time In' : 'Time Out'} in this class.`);
            setTimeout(() => setError(null), 5000);
            return;
        }

        setQrStep("generating");
        setError(null);

        try {
            const res = await fetch("/api/qr/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: student.id,
                    room_id: roomId,
                    class_id: classId,
                    action: actionParam,
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                setError(data.error || data.message || "Failed to generate QR code");
                setQrStep("select");
                setTimeout(() => setError(null), 3000);
                return;
            }

            const QRCode = (await import("qrcode")).default;
            const dataUrl = await QRCode.toDataURL(data.qr_payload, {
                width: 300,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" },
                errorCorrectionLevel: "M",
            });
            setQrDataUrl(dataUrl);
            setCountdown(60);
            setQrStep("qr");

            generationCountsRef.current[countKey] = (generationCountsRef.current[countKey] || 0) + 1;
            forceRender(n => n + 1);

        } catch {
            setError("Failed to generate QR code. Please try again.");
            setQrStep("select");
            setTimeout(() => setError(null), 3000);
        }
    }, [student]);

    const handleLogout = () => {
        window.location.href = "/login";
    };

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-nu-500/10 via-dark-bg to-dark-bg">
            {/* Ambient Background Splashes */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-nu-500/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-nu-400/5 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="w-full max-w-3xl relative z-10">

                {/* Global Error Banner */}
                {error && step === "dashboard" && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)] animate-in fade-in slide-in-from-top-4 backdrop-blur-md">
                        <AlertTriangle className="h-5 w-5 shrink-0 drop-shadow-md" />
                        <p className="text-sm font-bold tracking-wide">{error}</p>
                    </div>
                )}

                {/* Login Screen */}
                {step === "login" && (
                    <div>
                        <div className="text-center mb-10 relative z-10">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-panel border border-nu-500/20 mb-5 shadow-[0_0_20px_rgba(176,42,42,0.3)]">
                                <ShieldCheck className="h-8 w-8 text-nu-500 drop-shadow-md" />
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-widest uppercase drop-shadow-sm">Student Portal</h1>
                            <p className="text-xs text-nu-400 mt-2 uppercase tracking-[0.2em] font-bold">ClassTrack Verification System</p>
                        </div>

                        <div className="glass-card rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-t-white/10 group transform transition-all hover:shadow-[0_0_60px_rgba(176,42,42,0.15)] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nu-500/50 to-transparent"></div>

                            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2 tracking-widest uppercase">
                                <Search className="h-5 w-5 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                                Student Identification
                            </h2>
                            <p className="text-sm text-gray-400 mb-8 font-medium">
                                Enter your Student ID Number (SIN) to access your attendance records and generate QR codes.
                            </p>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 text-red-400 text-sm font-bold tracking-wide rounded-xl border border-red-500/20 flex items-center gap-3 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)]">
                                    <AlertTriangle className="h-5 w-5 shrink-0 drop-shadow-md" />
                                    {error}
                                </div>
                            )}

                            <input
                                type="text"
                                value={sin}
                                onChange={(e) => setSin(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && lookupStudent()}
                                placeholder="e.g. 2024-00123"
                                className="w-full px-4 py-4 rounded-xl glass-input text-center text-xl tracking-[0.2em] font-mono text-white placeholder-gray-500 shadow-inner focus:border-nu-400/50"
                                autoFocus
                            />
                            <button
                                onClick={lookupStudent}
                                disabled={loading || !sin.trim()}
                                className="w-full mt-6 py-4 rounded-xl bg-nu-500 hover:bg-nu-400 disabled:bg-white/5 disabled:border-white/10 disabled:text-gray-600 disabled:shadow-none text-white font-bold transition-all duration-300 flex items-center justify-center gap-3 shadow-glow-red hover:shadow-[0_0_30px_rgba(176,42,42,0.6)] hover:scale-[1.02] active:scale-95 uppercase tracking-widest overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none"></div>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin drop-shadow-md" /> : <ShieldCheck className="h-5 w-5 drop-shadow-md" />}
                                <span className="drop-shadow-sm">{loading ? "Authenticating..." : "Access Portal"}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Dashboard Interface */}
                {step === "dashboard" && student && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        {/* Profile Header */}
                        <div className="glass-panel shadow-[0_0_30px_rgba(176,42,42,0.2)] rounded-3xl p-8 mb-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-nu-500/20 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none group-hover:bg-nu-500/30 transition-colors duration-700"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <h2 className="font-black text-3xl text-white tracking-wide drop-shadow-md">{student.name}</h2>
                                    <p className="text-nu-400 text-sm mt-1.5 font-mono tracking-[0.2em] font-bold">{sin}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase text-gray-300 hover:text-white transition-all border border-white/10 hover:border-white/20 shadow-sm"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="bg-dark-surface/50 backdrop-blur-md rounded-2xl p-2 shadow-inner border border-white/5 mb-6 flex gap-2 overflow-x-auto no-scrollbar relative z-10">
                            <button
                                onClick={() => setActiveTab("qr")}
                                className={`flex-1 min-w-[100px] flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all text-xs font-bold uppercase tracking-widest ${activeTab === "qr" ? "bg-nu-500/20 border border-nu-500/30 text-nu-400 shadow-[inset_0_1px_4px_rgba(239,68,68,0.2)]" : "bg-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent"}`}
                            >
                                <QrCode className={`h-5 w-5 drop-shadow-sm ${activeTab === "qr" ? "text-nu-400" : "text-gray-500"}`} />
                                QR Code
                            </button>
                            <button
                                onClick={() => setActiveTab("attendance")}
                                className={`flex-1 min-w-[100px] flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all text-xs font-bold uppercase tracking-widest ${activeTab === "attendance" ? "bg-nu-500/20 border border-nu-500/30 text-nu-400 shadow-[inset_0_1px_4px_rgba(239,68,68,0.2)]" : "bg-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent"}`}
                            >
                                <Activity className={`h-5 w-5 drop-shadow-sm ${activeTab === "attendance" ? "text-nu-400" : "text-gray-500"}`} />
                                Records
                            </button>
                            <button
                                onClick={() => setActiveTab("excuse")}
                                className={`flex-1 min-w-[100px] flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all text-xs font-bold uppercase tracking-widest ${activeTab === "excuse" ? "bg-nu-500/20 border border-nu-500/30 text-nu-400 shadow-[inset_0_1px_4px_rgba(239,68,68,0.2)]" : "bg-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent"}`}
                            >
                                <FileText className={`h-5 w-5 drop-shadow-sm ${activeTab === "excuse" ? "text-nu-400" : "text-gray-500"}`} />
                                Excuse
                            </button>
                        </div>

                        {/* ----------------- TAB: QR Generator ----------------- */}
                        {activeTab === "qr" && (
                            <div className="animate-in slide-in-from-left-4 fade-in duration-300">

                                {qrStep === "select" && (
                                    <div className="glass-card rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border-t border-t-white/10">
                                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-6 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-gray-500 drop-shadow-sm" />
                                            Generate Entry Pass
                                        </h3>

                                        {classes.length === 0 ? (
                                            <div className="text-center p-8 glass-panel rounded-2xl mt-4">
                                                <AlertTriangle className="h-10 w-10 text-yellow-500/50 mx-auto mb-3" />
                                                <p className="text-sm text-gray-400 font-bold tracking-wide">No active classes found.</p>
                                                <p className="text-xs text-gray-500 mt-2">Please contact your instructor if this is a mistake.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {classes.map((cls) => (
                                                    <button
                                                        key={cls.id}
                                                        onClick={() => {
                                                            setSelectedClass(cls.id);
                                                            setSelectedRoomId(cls.room_id);
                                                            if (cls.room_id) {
                                                                setQrStep("action");
                                                            } else {
                                                                setError("This class has no room assigned. Contact your instructor.");
                                                                setTimeout(() => setError(null), 3000);
                                                            }
                                                        }}
                                                        className="w-full text-left px-6 py-5 rounded-2xl glass-panel hover:bg-white/5 hover:border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all duration-300 group flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-white group-hover:text-nu-400 transition-colors text-lg tracking-wide drop-shadow-sm">
                                                                {cls.name}
                                                            </p>
                                                            <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                                <span className="flex items-center gap-1.5 bg-dark-bg px-2.5 py-1 rounded-md border border-white/5 shadow-inner">
                                                                    <Clock className="h-3.5 w-3.5 text-gray-500" />
                                                                    {new Date(`1970-01-01T${cls.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}
                                                                    {" – "}
                                                                    {new Date(`1970-01-01T${cls.end_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}
                                                                </span>
                                                                {cls.room_name && (
                                                                    <span className="flex items-center gap-1.5 text-gray-400 bg-dark-bg px-2.5 py-1 rounded-md border border-white/5 shadow-inner">
                                                                        {cls.room_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="h-10 w-10 rounded-full bg-dark-surface border border-white/5 group-hover:bg-nu-500/20 group-hover:border-nu-500/30 flex items-center justify-center transition-all duration-300 shadow-inner group-hover:shadow-[0_0_10px_rgba(176,42,42,0.4)]">
                                                            <QrCode className="h-4 w-4 text-gray-500 group-hover:text-nu-400 drop-shadow-sm" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {qrStep === "action" && selectedClass && (
                                    <div className="glass-card rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border-t border-t-white/10">
                                        <div className="mb-8 flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] font-bold text-nu-400 uppercase tracking-[0.2em] mb-1.5">Target Class</p>
                                                <p className="text-white font-bold text-xl leading-tight tracking-wide drop-shadow-sm">
                                                    {classes.find((c) => c.id === selectedClass)?.name}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { setQrStep("select"); setAction(null); }}
                                                className="h-10 w-10 glass-panel hover:bg-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-inner"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <button
                                                onClick={() => {
                                                    setAction("check_in");
                                                    if (selectedRoomId) generateQR(selectedClass, selectedRoomId, "check_in");
                                                }}
                                                className="w-full flex items-center justify-between px-6 py-6 rounded-2xl glass-panel hover:bg-green-500/10 border border-transparent hover:border-green-500/20 transition-all duration-300 group shadow-sm text-left hover:shadow-[0_0_20px_rgba(74,222,128,0.15)]"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="h-12 w-12 rounded-full bg-dark-surface border border-white/5 flex items-center justify-center group-hover:bg-green-500 group-hover:border-green-400 transition-all duration-500 shadow-inner group-hover:shadow-[0_0_15px_rgba(74,222,128,0.6)]">
                                                        <span className="text-gray-400 group-hover:text-white group-hover:drop-shadow-md font-bold text-xl transform group-hover:translate-y-1 transition-transform">↓</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xl font-bold text-white group-hover:text-green-400 transition-colors drop-shadow-sm tracking-wide">Time In</p>
                                                        <p className="text-xs text-gray-500 mt-1 font-bold uppercase tracking-widest group-hover:text-green-500/70 transition-colors">Record instance of arrival</p>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setAction("check_out");
                                                    if (selectedRoomId) generateQR(selectedClass, selectedRoomId, "check_out");
                                                }}
                                                className="w-full flex items-center justify-between px-6 py-6 rounded-2xl glass-panel hover:bg-orange-500/10 border border-transparent hover:border-orange-500/20 transition-all duration-300 group shadow-sm text-left hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="h-12 w-12 rounded-full bg-dark-surface border border-white/5 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-400 transition-all duration-500 shadow-inner group-hover:shadow-[0_0_15px_rgba(249,115,22,0.6)]">
                                                        <span className="text-gray-400 group-hover:text-white group-hover:drop-shadow-md font-bold text-xl transform group-hover:-translate-y-1 transition-transform">↑</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors drop-shadow-sm tracking-wide">Time Out</p>
                                                        <p className="text-xs text-gray-500 mt-1 font-bold uppercase tracking-widest group-hover:text-orange-500/70 transition-colors">Record instance of departure</p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {qrStep === "generating" && (
                                    <div className="glass-card rounded-3xl p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-t-white/10 text-center relative overflow-hidden">
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-nu-500/20 rounded-full blur-[60px] animate-pulse-slow"></div>
                                        <Loader2 className="h-12 w-12 text-nu-400 animate-spin mx-auto mb-6 drop-shadow-[0_0_15px_rgba(176,42,42,0.8)] relative z-10" />
                                        <p className="text-white font-bold text-xl tracking-wide relative z-10">Securely Generating QR...</p>
                                        <p className="text-xs text-nu-400/80 mt-3 font-bold uppercase tracking-[0.2em] relative z-10">Encrypting localized timestamps</p>
                                    </div>
                                )}

                                {qrStep === "qr" && qrDataUrl && (
                                    <div className="glass-card rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-t-white/10 text-center relative">
                                        <div className="mb-6 pb-6 border-b border-white/5">
                                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 drop-shadow-sm ${action === "check_in" ? 'text-green-400' : 'text-orange-400'}`}>
                                                {action === "check_out" ? "TIME OUT FOR" : "TIME IN FOR"}
                                            </p>
                                            <h2 className="text-xl font-bold text-white tracking-wide">
                                                {classes.find(c => c.id === selectedClass)?.name || "Current Class"}
                                            </h2>
                                        </div>

                                        <div className="flex items-center justify-between mb-6 bg-dark-bg/80 px-4 py-3 rounded-xl border border-white/5 shadow-inner">
                                            <div className="flex items-center gap-3">
                                                <ShieldCheck className="h-5 w-5 text-gray-500 drop-shadow-sm" />
                                                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Scan before expiry</span>
                                            </div>
                                            <div className={`px-3 py-1 rounded-md text-xs font-bold font-mono tracking-widest shadow-sm border ${countdown > 20 ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]' :
                                                countdown > 10 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_0_10px_rgba(250,204,21,0.2)]' :
                                                    'bg-red-500/10 text-nu-400 border-nu-500/20 shadow-[0_0_15px_rgba(176,42,42,0.4)] animate-pulse'
                                                }`}>
                                                00:{countdown.toString().padStart(2, '0')}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-4 inline-block mb-6 shadow-[0_0_40px_rgba(255,255,255,0.15)] relative transform transition-transform duration-500 hover:scale-[1.03]">
                                            <div className="absolute -top-4 -right-4 glass-panel bg-dark-surface/90 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg shadow-md border border-white/10 backdrop-blur-md">
                                                Shot {generationCountsRef.current[`${selectedClass || ""}:${action || "check_in"}`] || 1}/3
                                            </div>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={qrDataUrl} alt="Secure Attendance QR Code" className="w-[240px] h-[240px] mx-auto rounded-xl pointer-events-none" />
                                        </div>

                                        {/* Progress bar line */}
                                        <div className="mt-2 mb-8 h-1.5 w-full bg-dark-bg rounded-full overflow-hidden border border-white/5 shadow-inner">
                                            <div
                                                className={`h-full transition-all duration-1000 ease-linear shadow-[0_0_10px_currentColor] ${countdown > 10 ? 'bg-nu-500 text-nu-500' : 'bg-red-500 text-red-500'}`}
                                                style={{ width: `${(countdown / 60) * 100}%` }}
                                            />
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => { setQrStep("select"); setAction(null); }}
                                                className="flex-1 py-4 text-xs tracking-widest font-bold text-gray-400 uppercase glass-input hover:text-white hover:border-white/20 transition-all rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (selectedClass && selectedRoomId && action) {
                                                        generateQR(selectedClass, selectedRoomId, action);
                                                    }
                                                }}
                                                className="flex-1 py-4 text-xs tracking-widest font-bold text-white uppercase bg-nu-500 hover:bg-nu-400 rounded-xl transition-all duration-300 shadow-glow-red hover:shadow-[0_0_20px_rgba(176,42,42,0.6)] hover:-translate-y-0.5"
                                            >
                                                Regenerate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ----------------- TAB: Attendance Records ----------------- */}
                        {activeTab === "attendance" && (
                            <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                                <StudentAttendance sin={sin} />
                            </div>
                        )}

                        {/* ----------------- TAB: Excuse Letter ----------------- */}
                        {activeTab === "excuse" && (
                            <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                                {/* We embed the extracted content here */}
                                <SubmitEvidenceContent sin={sin} />
                            </div>
                        )}

                    </div>
                )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-8 font-medium">
                ClassTrack v3.3 • Integrated Student Services
            </p>
        </div>
    );
}
