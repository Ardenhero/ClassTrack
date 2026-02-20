"use client";

import { useState, useEffect, useCallback } from "react";
import { QrCode, Clock, AlertTriangle, CheckCircle2, Loader2, Search, ShieldCheck } from "lucide-react";

// Student Portal — PWA-ready page for QR fallback attendance
export default function StudentPortalPage() {
    const [sin, setSin] = useState("");
    const [step, setStep] = useState<"login" | "select" | "action" | "generating" | "qr" | "error">("login");
    const [student, setStudent] = useState<{ id: number; name: string } | null>(null);
    const [classes, setClasses] = useState<{ id: string; name: string; room_id: string | null; room_name: string | null; start_time: string; end_time: string }[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [action, setAction] = useState<"check_in" | "check_out" | null>(null);
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
                    action: action,
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
                color: { dark: "#000000", light: "#ffffff" },
                errorCorrectionLevel: "M",
            });
            setQrDataUrl(dataUrl);
            setCountdown(60);
            setStep("qr");

        } catch {
            setError("Failed to generate QR code. Please try again.");
            setStep("error");
        }
    }, [student, action]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-100 mb-4 shadow-sm">
                        <ShieldCheck className="h-8 w-8 text-nwu-red" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">ClassTrack</h1>
                    <p className="text-sm text-gray-500 mt-1">Verified QR Attendance</p>
                </div>

                {/* Step 1: Login */}
                {step === "login" && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Search className="h-5 w-5 text-nwu-red" />
                            Student Identification
                        </h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Enter your Student ID Number (SIN) to generate a verified attendance QR code.
                        </p>
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
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            {loading ? "Looking up..." : "Continue"}
                        </button>
                    </div>
                )}

                {/* Step 2: Select Class */}
                {step === "select" && student && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-gray-900 font-semibold">{student.name}</p>
                                <p className="text-xs text-gray-500">SIN: {sin}</p>
                            </div>
                        </div>

                        <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider mb-3">
                            Select Your Class
                        </h3>

                        {classes.length === 0 ? (
                            <p className="text-sm text-gray-500 italic py-4 text-center">
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
                                                setStep("action");
                                            } else {
                                                setError("This class has no room assigned. Contact your instructor.");
                                                setStep("error");
                                            }
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all group shadow-sm"
                                    >
                                        <p className="font-medium text-gray-900 group-hover:text-nwu-red transition-colors">
                                            {cls.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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
                            className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            ← Different Student
                        </button>
                    </div>
                )}

                {/* Step 2.5: Select Action */}
                {step === "action" && selectedClass && selectedRoomId && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                                <Clock className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-gray-900 font-semibold">Attendance Action</p>
                                <p className="text-xs text-gray-500">What are you scanning for?</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setAction("check_in");
                                    generateQR(selectedClass, selectedRoomId);
                                }}
                                className="w-full flex items-center justify-between px-6 py-4 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 transition-all group shadow-sm text-left"
                            >
                                <div>
                                    <p className="font-bold text-green-700">Time In</p>
                                    <p className="text-xs text-green-600 mt-1.5">Record your arrival for this class</p>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-green-200 flex items-center justify-center group-hover:bg-green-300 transition-colors">
                                    <span className="text-green-800 font-bold">→</span>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setAction("check_out");
                                    generateQR(selectedClass, selectedRoomId);
                                }}
                                className="w-full flex items-center justify-between px-6 py-4 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-all group shadow-sm text-left"
                            >
                                <div>
                                    <p className="font-bold text-orange-700">Time Out</p>
                                    <p className="text-xs text-orange-600 mt-1.5">Record your departure from class</p>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-orange-200 flex items-center justify-center group-hover:bg-orange-300 transition-colors">
                                    <span className="text-orange-800 font-bold">→</span>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => { setStep("select"); setAction(null); }}
                            className="w-full mt-6 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            ← Back to Classes
                        </button>
                    </div>
                )}

                {/* Step 3: Generating */}
                {step === "generating" && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-md text-center">
                        <Loader2 className="h-12 w-12 text-nwu-red animate-spin mx-auto mb-4" />
                        <p className="text-gray-900 font-semibold">Generating QR Code...</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Please wait a moment.
                        </p>
                    </div>
                )}

                {/* Step 4: QR Display */}
                {step === "qr" && qrDataUrl && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md text-center">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-nwu-red" />
                                <span className="text-gray-900 font-semibold">Show to Instructor</span>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${countdown > 20 ? 'bg-green-100 text-green-700 border border-green-200' :
                                countdown > 10 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                    'bg-red-100 text-red-700 border border-red-200 animate-pulse'
                                }`}>
                                {countdown}s
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 inline-block mb-4 border border-gray-100 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrDataUrl} alt="Attendance QR Code" className="w-64 h-64 mx-auto" />
                        </div>

                        <p className="text-sm text-gray-500">
                            {student?.name} • <span className="text-green-600 font-semibold">Verified ✓</span>
                        </p>

                        {/* Progress bar */}
                        <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-nwu-red transition-all duration-1000 ease-linear"
                                style={{ width: `${(countdown / 60) * 100}%` }}
                            />
                        </div>

                        <button
                            onClick={() => {
                                if (selectedClass && selectedRoomId) {
                                    generateQR(selectedClass, selectedRoomId);
                                }
                            }}
                            className="mt-4 px-4 py-2 text-sm text-nwu-red hover:text-red-800 transition-colors"
                        >
                            Regenerate QR
                        </button>
                    </div>
                )}

                {/* Error State */}
                {step === "error" && (
                    <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-md text-center">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <p className="text-gray-900 font-semibold mb-2">Error</p>
                        <p className="text-sm text-gray-600 mb-6">{error}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep("login"); setSin(""); setStudent(null); setError(null); }}
                                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-all text-sm font-semibold shadow-sm"
                            >
                                Start Over
                            </button>
                            {student && (
                                <button
                                    onClick={() => { setStep("select"); setError(null); }}
                                    className="flex-1 py-2 rounded-xl bg-nwu-red text-white hover:bg-red-800 transition-all text-sm font-semibold shadow-sm"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    ClassTrack v3.2 • Anti-Proxy Verified Attendance
                </p>
            </div>
        </div>
    );
}
