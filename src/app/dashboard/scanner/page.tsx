"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/context/ProfileContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Camera, CheckCircle2, AlertTriangle, QrCode, X, Loader2, UserCheck } from "lucide-react";

interface ScanResult {
    student_id: number;
    student_name: string;
    room_id: string;
    room_name: string;
    class_id: string;
}

export default function ScannerPage() {
    const { profile } = useProfile();
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logging, setLogging] = useState(false);
    const [logged, setLogged] = useState(false);
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [classesLoading, setClassesLoading] = useState(true);
    const selectedClassRef = useRef<string>("");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        selectedClassRef.current = selectedClass;
    }, [selectedClass]);

    // Load instructor's classes
    useEffect(() => {
        if (!profile) return;
        const supabase = createClient();
        setClassesLoading(true);
        const loadClasses = async () => {
            const { data } = await supabase
                .from('classes')
                .select('id, name')
                .eq('instructor_id', profile.id)
                .order('name');
            setClasses(data || []);
            if (data && data.length > 0) {
                setSelectedClass(data[0].id);
                selectedClassRef.current = data[0].id;
            }
            setClassesLoading(false);
        };
        loadClasses();
    }, [profile]);

    // Start camera
    const startScanning = useCallback(async () => {
        setError(null);
        setResult(null);
        setLogged(false);

        try {
            // Attempt 1: Standard definition (ideal for QR scanning speed)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setScanning(true);
            scanFrame();
        } catch (err1) {
            console.warn("Primary camera request failed, trying fallback:", err1);

            try {
                // Attempt 2: Absolute minimum requirements (just "gimme a camera")
                const fallbackStream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
                streamRef.current = fallbackStream;

                if (videoRef.current) {
                    videoRef.current.srcObject = fallbackStream;
                    await videoRef.current.play();
                }
                setScanning(true);
                scanFrame();
            } catch (err2) {
                console.error("All camera requests failed:", err2);
                const error = err2 as Error;
                const errorDetails = error?.name || "UnknownError";
                if (errorDetails === "NotAllowedError") {
                    setError("Camera access denied by browser. Please check your browser's site settings and allow camera access.");
                } else if (errorDetails === "NotFoundError") {
                    setError("No camera device found on this system.");
                } else if (errorDetails === "NotReadableError") {
                    setError("Camera is already in use by another application.");
                } else {
                    setError(`Camera failed: ${errorDetails}. Please ensure permissions are granted.`);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Stop camera
    const stopScanning = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        setScanning(false);
    }, []);

    // Scan frames for QR codes
    const scanFrame = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationRef.current = requestAnimationFrame(scanFrame);
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        try {
            // Dynamic import jsQR
            const jsQR = (await import("jsqr")).default;
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.data) {
                // Found a QR code - verify it
                await verifyQR(code.data);
                return; // Stop scanning after finding code
            }
        } catch {
            // jsQR not available, try alternative decoder
        }

        animationRef.current = requestAnimationFrame(scanFrame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Verify scanned QR
    const verifyQR = async (payload: string) => {
        stopScanning();

        const currentClass = selectedClassRef.current;
        if (!currentClass) {
            setError("Please select a class first.");
            return;
        }

        try {
            const res = await fetch("/api/qr/generate", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qr_payload: payload, class_id: currentClass }),
            });

            const data = await res.json();

            if (data.error === "expired_qr") {
                setError("QR code has expired. Ask the student to generate a new one.");
                return;
            }

            if (data.error === "invalid_qr") {
                setError("Invalid QR code. Not a ClassTrack attendance code.");
                return;
            }

            if (!res.ok || data.error) {
                setError(data.message || data.error || "Verification failed");
                return;
            }

            setResult(data);
        } catch {
            setError("Network error during verification.");
        }
    };

    // Log attendance via QR
    const logAttendance = async () => {
        if (!result || !profile) return;
        setLogging(true);

        try {
            // Profile type doesn't include email — get it from auth user
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            const email = user?.email || '';

            const res = await fetch(`/api/attendance/log?email=${encodeURIComponent(email)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    attendance_type: "Time In",
                    timestamp: new Date().toISOString(),
                    class_id: result.class_id,
                    instructor_id: profile.id,
                    fingerprint_slot_id: undefined,
                    device_id: undefined,
                    entry_method: "qr_verified",
                    student_name: result.student_name,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setLogged(true);
            } else {
                setError(data.error || "Failed to log attendance");
            }
        } catch {
            setError("Network error while logging attendance.");
        } finally {
            setLogging(false);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopScanning();
        };
    }, [stopScanning]);

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-nwu-red flex items-center gap-2">
                            <QrCode className="h-6 w-6 text-nwu-red" />
                            QR Attendance Scanner
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Scan a student&apos;s verified QR code for fallback attendance.
                        </p>
                    </div>
                </div>

                {/* Class Selector */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                    <label className="block text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">
                        Active Class
                    </label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-medium focus:ring-red-500 focus:border-red-500"
                    >
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Camera View */}
                <div className="relative bg-black rounded-2xl overflow-hidden shadow-sm aspect-video">
                    <video
                        ref={videoRef}
                        className={`w-full h-full object-cover ${scanning ? 'block' : 'hidden'}`}
                        playsInline
                        muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {!scanning && !result && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-50">
                            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                                <Camera className="h-10 w-10 text-nwu-red" />
                            </div>
                            <button
                                onClick={startScanning}
                                disabled={!selectedClass || classesLoading}
                                className="px-6 py-3 bg-nwu-red hover:bg-red-800 disabled:bg-gray-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-sm"
                            >
                                {classesLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Loading Classes...</> : "Start Scanning"}
                            </button>
                        </div>
                    )}

                    {scanning && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {/* Scanning overlay */}
                            <div className="w-56 h-56 border-2 border-nwu-red rounded-2xl relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                                {/* Scan line animation */}
                                <div className="absolute left-2 right-2 h-[2px] bg-red-400 animate-[bounce_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(248,113,113,0.8)]" style={{ top: '50%' }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Scan Controls */}
                {scanning && (
                    <button
                        onClick={stopScanning}
                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-gray-200"
                    >
                        <X className="h-5 w-5" />
                        Stop Scanning
                    </button>
                )}

                {/* Result */}
                {result && !logged && (
                    <div className="bg-white rounded-2xl border-2 border-green-500 p-6 space-y-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                                <UserCheck className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-900">
                                    {result.student_name}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {result.room_name} • QR Verified ✓
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={logAttendance}
                                disabled={logging}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                {logging ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                {logging ? "Logging..." : "Confirm Attendance"}
                            </button>
                            <button
                                onClick={() => { setResult(null); startScanning(); }}
                                className="px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-all"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                )}

                {/* Logged Confirmation */}
                {logged && (
                    <div className="bg-green-50 rounded-2xl border border-green-200 p-6 text-center space-y-3 shadow-sm">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                        <p className="text-lg font-bold text-green-800">
                            Attendance Logged!
                        </p>
                        <p className="text-sm text-green-700">
                            {result?.student_name} — QR Verified Fallback
                        </p>
                        <button
                            onClick={() => { setLogged(false); setResult(null); startScanning(); }}
                            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all shadow-sm"
                        >
                            Scan Next Student
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex items-start gap-3 shadow-sm">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-red-800">{error}</p>
                            <button
                                onClick={() => { setError(null); startScanning(); }}
                                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
