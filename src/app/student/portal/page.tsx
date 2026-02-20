"use client";

import { useState, useEffect, useCallback } from "react";
import { QrCode, Clock, AlertTriangle, CheckCircle2, Loader2, Search, ShieldCheck } from "lucide-react";

// Student Portal — PWA-ready page for QR fallback attendance
export default function StudentPortalPage() {
    const [sin, setSin] = useState("");
    const [step, setStep] = useState<"login" | "select" | "generating" | "qr" | "error">("login");
    const [student, setStudent] = useState<{ id: number; name: string } | null>(null);
    const [classes, setClasses] = useState<{ id: string; name: string; room_id: string | null; room_name: string | null; start_time: string; end_time: string }[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(60);
    const [loading, setLoading] = useState(false);

    // Countdown timer for QR expiration
    useEffect(() => {
        if (step !== "qr") return;
        if (countdown <= 0) {
            setStep("select");
            setQrDataUrl(null);
            setCountdown(60);
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [step, countdown]);

    // Step 1: Look up student by SIN
    const lookupStudent = async () => {
        if (!sin.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/qr/student-lookup?sin=${encodeURIComponent(sin.trim())}`);
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || "Student not found. Check your ID number.");
                setStep("error");
                return;
            }
            setStudent(data.student);
            setClasses(data.classes);
            setStep("select");
        } catch {
            setError("Network error. Please check your connection.");
            setStep("error");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Generate QR code
    const generateQR = useCallback(async (classId: string, roomId: string) => {
        if (!student) return;
        setStep("generating");
        setError(null);

        try {
            // Call QR generation API
            const res = await fetch("/api/qr/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: student.id,
                    room_id: roomId,
                    class_id: classId,
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                setError(data.error || data.message || "Failed to generate QR code");
                setStep("error");
                return;
            }

            // Generate QR code image client-side
            const QRCode = (await import("qrcode")).default;
            const dataUrl = await QRCode.toDataURL(data.qr_payload, {
                width: 300,
                margin: 2,
                color: { dark: "#1a1a2e", light: "#ffffff" },
                errorCorrectionLevel: "M",
            });
            setQrDataUrl(dataUrl);
            setCountdown(60);
            setStep("qr");

        } catch {
            setError("Failed to generate QR code. Please try again.");
            setStep("error");
        }
    }, [student]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 mb-4">
                        <ShieldCheck className="h-8 w-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">ClassTrack</h1>
                    <p className="text-sm text-slate-400 mt-1">Verified QR Attendance</p>
                </div>

                {/* Step 1: Login */}
                {step === "login" && (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Search className="h-5 w-5 text-indigo-400" />
                            Student Identification
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">
                            Enter your Student ID Number (SIN) to generate a verified attendance QR code.
                        </p>
                        <input
                            type="text"
                            value={sin}
                            onChange={(e) => setSin(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && lookupStudent()}
                            placeholder="e.g. 2024-00123"
                            className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-center text-lg tracking-wider font-mono"
                            autoFocus
                        />
                        <button
                            onClick={lookupStudent}
                            disabled={loading || !sin.trim()}
                            className="w-full mt-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            {loading ? "Looking up..." : "Continue"}
                        </button>
                    </div>
                )}

                {/* Step 2: Select Class */}
                {step === "select" && student && (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-white font-semibold">{student.name}</p>
                                <p className="text-xs text-slate-400">SIN: {sin}</p>
                            </div>
                        </div>

                        <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-3">
                            Select Your Class
                        </h3>

                        {classes.length === 0 ? (
                            <p className="text-sm text-slate-500 italic py-4 text-center">
                                No classes found. Contact your instructor.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {classes.map((cls) => (
                                    <button
                                        key={cls.id}
                                        onClick={() => {
                                            setSelectedClass(cls.id);
                                            setSelectedRoomId(cls.room_id);
                                            if (cls.room_id) {
                                                generateQR(cls.id, cls.room_id);
                                            } else {
                                                setError("This class has no room assigned. Contact your instructor.");
                                                setStep("error");
                                            }
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-xl bg-slate-700/40 hover:bg-indigo-600/30 border border-slate-600/50 hover:border-indigo-500/50 transition-all group"
                                    >
                                        <p className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                                            {cls.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {cls.start_time?.slice(0, 5)} – {cls.end_time?.slice(0, 5)}
                                            </span>
                                            {cls.room_name && (
                                                <span className="flex items-center gap-1">
                                                    {cls.room_name}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => { setStep("login"); setStudent(null); setSin(""); }}
                            className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            ← Different Student
                        </button>
                    </div>
                )}

                {/* Step 3: Generating */}
                {step === "generating" && (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl text-center">
                        <Loader2 className="h-12 w-12 text-indigo-400 animate-spin mx-auto mb-4" />
                        <p className="text-white font-semibold">Generating QR Code...</p>
                        <p className="text-sm text-slate-400 mt-2">
                            Please wait a moment.
                        </p>
                    </div>
                )}

                {/* Step 4: QR Display */}
                {step === "qr" && qrDataUrl && (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 shadow-2xl text-center">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-indigo-400" />
                                <span className="text-white font-semibold">Show to Instructor</span>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${countdown > 20 ? 'bg-green-500/20 text-green-400' :
                                countdown > 10 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400 animate-pulse'
                                }`}>
                                {countdown}s
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 inline-block mb-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrDataUrl} alt="Attendance QR Code" className="w-64 h-64" />
                        </div>

                        <p className="text-sm text-slate-400">
                            {student?.name} • Verified ✓
                        </p>

                        {/* Progress bar */}
                        <div className="mt-4 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-linear"
                                style={{ width: `${(countdown / 60) * 100}%` }}
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (selectedClass && selectedRoomId) {
                                    generateQR(selectedClass, selectedRoomId);
                                }
                            }}
                            className="mt-4 px-4 py-2 text-sm text-indigo-400 hover:text-white transition-colors"
                        >
                            Regenerate QR
                        </button>
                    </div>
                )}

                {/* Error State */}
                {step === "error" && (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6 shadow-2xl text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="h-6 w-6 text-red-400" />
                        </div>
                        <p className="text-white font-semibold mb-2">Error</p>
                        <p className="text-sm text-slate-400 mb-6">{error}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep("login"); setSin(""); setStudent(null); setError(null); }}
                                className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all text-sm"
                            >
                                Start Over
                            </button>
                            {student && (
                                <button
                                    onClick={() => { setStep("select"); setError(null); }}
                                    className="flex-1 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all text-sm"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-6">
                    ClassTrack v3.2 • Anti-Proxy Verified Attendance
                </p>
            </div>
        </div>
    );
}
