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
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Loading your records...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex items-start gap-4 shadow-sm">
                <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-semibold mb-1">Could not load attendance</h3>
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
                <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-5">
                        <Activity className="h-32 w-32" />
                    </div>

                    <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider mb-6">Overall Attendance Summary</h3>

                    <div className="flex items-center gap-6 mb-6">
                        <div className="relative h-24 w-24 rounded-full flex items-center justify-center bg-gray-50 border-4 border-gray-100 shadow-inner">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle cx="44" cy="44" r="40" className="stroke-current text-gray-200" strokeWidth="8" fill="none" />
                                <circle
                                    cx="44" cy="44" r="40"
                                    className={`stroke-current ${ov.percentage >= 80 ? 'text-green-500' : ov.percentage >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
                                    strokeWidth="8"
                                    fill="none"
                                    strokeDasharray="251.2"
                                    strokeDashoffset={251.2 - (251.2 * ov.percentage) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="text-2xl font-black text-gray-800 tracking-tighter">{ov.percentage}%</span>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-2">
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Present</p>
                                <p className="text-xl font-black text-green-600">{ov.present}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Late</p>
                                <p className="text-xl font-black text-yellow-600">{ov.late}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Absent</p>
                                <p className="text-xl font-black text-red-600">{ov.absent}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Excused</p>
                                <p className="text-xl font-black text-blue-600">{ov.excuse_pending}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Per Class Breakdown */}
            <div>
                <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider mb-4 px-2">Per-Class Breakdown</h3>

                {stats.classes.length === 0 ? (
                    <p className="text-sm text-gray-500 italic p-6 text-center bg-gray-50 rounded-xl border border-gray-100">No classes found.</p>
                ) : (
                    <div className="space-y-3">
                        {stats.classes.map(cls => (
                            <div key={cls.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-gray-900 leading-tight">{cls.subject_name}</p>
                                        <p className="text-xs text-gray-500">{cls.section} • {cls.year_level}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${cls.percentage >= 80 ? 'bg-green-100 text-green-800' : cls.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                        {cls.percentage}%
                                    </span>
                                </div>

                                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <div className="bg-green-50 rounded p-1.5 border border-green-100">
                                        <p className="text-green-800 font-bold">{cls.present}</p>
                                        <p className="text-green-600 text-[10px] uppercase tracking-wider">Present</p>
                                    </div>
                                    <div className="bg-yellow-50 rounded p-1.5 border border-yellow-100">
                                        <p className="text-yellow-800 font-bold">{cls.late}</p>
                                        <p className="text-yellow-600 text-[10px] uppercase tracking-wider">Late</p>
                                    </div>
                                    <div className="bg-red-50 rounded p-1.5 border border-red-100">
                                        <p className="text-red-800 font-bold">{cls.absent}</p>
                                        <p className="text-red-600 text-[10px] uppercase tracking-wider">Absent</p>
                                    </div>
                                    <div className="bg-blue-50 rounded p-1.5 border border-blue-100">
                                        <p className="text-blue-800 font-bold">{cls.excuse_pending}</p>
                                        <p className="text-blue-600 text-[10px] uppercase tracking-wider">Excused</p>
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
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-3xl">

                {/* Global Error Banner */}
                {error && step === "dashboard" && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Login Screen */}
                {step === "login" && (
                    <div>
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-100 mb-4 shadow-sm">
                                <ShieldCheck className="h-8 w-8 text-nwu-red" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
                            <p className="text-sm text-gray-500 mt-1">ClassTrack Verification System</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Search className="h-5 w-5 text-nwu-red" />
                                Student Identification
                            </h2>
                            <p className="text-sm text-gray-600 mb-6">
                                Enter your Student ID Number (SIN) to access your attendance records and generate QR codes.
                            </p>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <input
                                type="text"
                                value={sin}
                                onChange={(e) => setSin(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && lookupStudent()}
                                placeholder="e.g. 2024-00123"
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-center text-lg tracking-wider font-mono shadow-sm"
                                autoFocus
                            />
                            <button
                                onClick={lookupStudent}
                                disabled={loading || !sin.trim()}
                                className="w-full mt-4 py-3 rounded-xl bg-nwu-red hover:bg-red-800 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                {loading ? "Authenticating..." : "Access Portal"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Dashboard Interface */}
                {step === "dashboard" && student && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        {/* Profile Header */}
                        <div className="bg-gradient-to-r from-nwu-red to-[#5e0d0e] rounded-2xl p-6 shadow-lg mb-4 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <h2 className="font-bold text-xl leading-tight">{student.name}</h2>
                                    <p className="text-red-200 text-sm mt-1 font-mono tracking-wide">{sin}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm transition-colors border border-white/10"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-200 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveTab("qr")}
                                className={`flex-1 min-w-[100px] flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all text-xs font-semibold ${activeTab === "qr" ? "bg-red-50 border-nwu-red text-nwu-red shadow-inner shadow-red-100" : "bg-transparent text-gray-500 hover:bg-gray-50"}`}
                            >
                                <QrCode className={`h-5 w-5 ${activeTab === "qr" ? "text-nwu-red" : "text-gray-400"}`} />
                                QR Code
                            </button>
                            <button
                                onClick={() => setActiveTab("attendance")}
                                className={`flex-1 min-w-[100px] flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all text-xs font-semibold ${activeTab === "attendance" ? "bg-red-50 border-nwu-red text-nwu-red shadow-inner shadow-red-100" : "bg-transparent text-gray-500 hover:bg-gray-50"}`}
                            >
                                <Activity className={`h-5 w-5 ${activeTab === "attendance" ? "text-nwu-red" : "text-gray-400"}`} />
                                Records
                            </button>
                            <button
                                onClick={() => setActiveTab("excuse")}
                                className={`flex-1 min-w-[100px] flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all text-xs font-semibold ${activeTab === "excuse" ? "bg-red-50 border-nwu-red text-nwu-red shadow-inner shadow-red-100" : "bg-transparent text-gray-500 hover:bg-gray-50"}`}
                            >
                                <FileText className={`h-5 w-5 ${activeTab === "excuse" ? "text-nwu-red" : "text-gray-400"}`} />
                                Excuse
                            </button>
                        </div>

                        {/* ----------------- TAB: QR Generator ----------------- */}
                        {activeTab === "qr" && (
                            <div className="animate-in slide-in-from-left-4 fade-in duration-300">

                                {qrStep === "select" && (
                                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 shadow-sm">
                                        <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-gray-400" />
                                            Generate Entry Pass
                                        </h3>

                                        {classes.length === 0 ? (
                                            <div className="text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
                                                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm text-gray-600 font-medium">No active classes found.</p>
                                                <p className="text-xs text-gray-400 mt-1">Please contact your instructor if this is a mistake.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
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
                                                        className="w-full text-left px-5 py-4 rounded-xl bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all group shadow-sm flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-nwu-red transition-colors text-base">
                                                                {cls.name}
                                                            </p>
                                                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 font-medium">
                                                                <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
                                                                    <Clock className="h-3 w-3" />
                                                                    {new Date(`1970-01-01T${cls.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}
                                                                    {" – "}
                                                                    {new Date(`1970-01-01T${cls.end_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}
                                                                </span>
                                                                {cls.room_name && (
                                                                    <span className="flex items-center gap-1 text-gray-400">
                                                                        {cls.room_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="h-8 w-8 rounded-full bg-gray-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                                                            <QrCode className="h-4 w-4 text-gray-400 group-hover:text-nwu-red" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {qrStep === "action" && selectedClass && (
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                        <div className="mb-6 flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-bold text-nwu-red uppercase tracking-wider mb-1">Target Class</p>
                                                <p className="text-gray-900 font-bold leading-tight">
                                                    {classes.find((c) => c.id === selectedClass)?.name}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { setQrStep("select"); setAction(null); }}
                                                className="h-8 w-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            <button
                                                onClick={() => {
                                                    setAction("check_in");
                                                    if (selectedRoomId) generateQR(selectedClass, selectedRoomId, "check_in");
                                                }}
                                                className="w-full flex items-center justify-between px-6 py-5 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 transition-all group shadow-sm text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center group-hover:bg-green-300 transition-colors">
                                                        <span className="text-green-800 font-bold text-lg">↓</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-green-800 text-lg leading-tight">Time In</p>
                                                        <p className="text-xs text-green-600 mt-0.5 font-medium">Record instance of arrival</p>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setAction("check_out");
                                                    if (selectedRoomId) generateQR(selectedClass, selectedRoomId, "check_out");
                                                }}
                                                className="w-full flex items-center justify-between px-6 py-5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-all group shadow-sm text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-orange-200 flex items-center justify-center group-hover:bg-orange-300 transition-colors">
                                                        <span className="text-orange-800 font-bold text-lg">↑</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-orange-800 text-lg leading-tight">Time Out</p>
                                                        <p className="text-xs text-orange-600 mt-0.5 font-medium">Record instance of departure</p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {qrStep === "generating" && (
                                    <div className="bg-white rounded-2xl border border-gray-200 p-10 shadow-sm text-center">
                                        <Loader2 className="h-10 w-10 text-nwu-red animate-spin mx-auto mb-4" />
                                        <p className="text-gray-900 font-bold">Securely Generating QR...</p>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">Encrypting localized timestamps</p>
                                    </div>
                                )}

                                {qrStep === "qr" && qrDataUrl && (
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md text-center">
                                        <div className="mb-4 pb-4 border-b border-gray-100">
                                            <p className={`text-xs font-black uppercase tracking-widest mb-1 ${action === "check_in" ? 'text-green-600' : 'text-orange-600'}`}>
                                                {action === "check_out" ? "TIME OUT FOR" : "TIME IN FOR"}
                                            </p>
                                            <h2 className="text-lg font-bold text-gray-900">
                                                {classes.find(c => c.id === selectedClass)?.name || "Current Class"}
                                            </h2>
                                        </div>

                                        <div className="flex items-center justify-between mb-4 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs text-gray-600 font-medium">Scan before expiry</span>
                                            </div>
                                            <div className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono tracking-wider ${countdown > 20 ? 'bg-green-100 text-green-700' :
                                                countdown > 10 ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700 animate-pulse'
                                                }`}>
                                                00:{countdown.toString().padStart(2, '0')}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl p-4 inline-block mb-4 border-2 border-dashed border-gray-200 relative">
                                            <div className="absolute -top-3 -right-3 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm border border-gray-700">
                                                Shot {generationCountsRef.current[`${selectedClass || ""}:${action || "check_in"}`] || 1}/3
                                            </div>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={qrDataUrl} alt="Secure Attendance QR Code" className="w-56 h-56 mx-auto" />
                                        </div>

                                        {/* Progress bar line */}
                                        <div className="mt-2 mb-6 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ease-linear ${countdown > 10 ? 'bg-nwu-red' : 'bg-red-500'}`}
                                                style={{ width: `${(countdown / 60) * 100}%` }}
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setQrStep("select"); setAction(null); }}
                                                className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (selectedClass && selectedRoomId && action) {
                                                        generateQR(selectedClass, selectedRoomId, action);
                                                    }
                                                }}
                                                className="flex-1 py-3 text-sm font-semibold text-white bg-nwu-red hover:bg-red-800 rounded-xl transition-colors shadow-sm"
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
