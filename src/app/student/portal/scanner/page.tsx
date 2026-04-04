"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLatestStudentRecord } from "../actions";
import { getStudentSession } from "@/lib/student-session";
import { StudentLayout } from "@/components/student/StudentLayout";
import { 
    Loader2, 
    QrCode, 
    AlertTriangle, 
    Camera, 
    CheckCircle2, 
    ShieldCheck, 
    Info 
} from "lucide-react";

interface Student {
    name: string;
    sin: string;
    image_url?: string;
    status?: string;
}

export default function ScannerPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // QR Scanner State
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ success: boolean; message: string; action?: string } | null>(null);
    const [scanProcessing, setScanProcessing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const jsQrRef = useRef<((data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }) => { data: string } | null) | null>(null);
    const scanLockRef = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function checkAuth() {
            const session = await getStudentSession();
            if (!session) {
                router.push("/student/portal");
                return;
            }
            
            // Sync live status
            const latest = await getLatestStudentRecord();
            if (latest.student) {
                setStudent(latest.student);
            } else {
                setStudent(session);
            }
            setLoading(false);
        }
        checkAuth();
    }, [router]);

    // Load jsQR library
    useEffect(() => {
        import("jsqr").then((module) => {
            jsQrRef.current = module.default;
        }).catch(err => console.error("Failed to load jsQR:", err));
    }, []);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

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

    const handleScanResult = async (payload: string) => {
        if (!student) return;
        stopScanning();
        setScanProcessing(true);

        try {
            const res = await fetch("/api/qr/session", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qr_payload: payload, student_sin: student.sin }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setScanResult({
                    success: true,
                    message: data.message || "Scanned successfully!",
                    action: data.action,
                });
            } else {
                setScanResult({
                    success: false,
                    message: data.message || data.error || "Scan failed. Please try again.",
                });
            }
        } catch {
            setScanResult({
                success: false,
                message: "Network error. Please check your connection.",
            });
        } finally {
            setScanProcessing(false);
        }
    };

    const scanFrame = useCallback(() => {
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
            if (jsQrRef.current && !scanLockRef.current) {
                const code = jsQrRef.current(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "attemptBoth",
                });
                if (code && code.data) {
                    scanLockRef.current = true;
                    handleScanResult(code.data);
                    return;
                }
            }
        } catch (err) {
            console.error("[QR] Scan error:", err);
        }

        animationRef.current = requestAnimationFrame(scanFrame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student]);

    const startScanning = useCallback(async () => {
        setScanResult(null);
        scanLockRef.current = false;
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "environment" }
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setScanning(true);
            scanFrame();
        } catch (err) {
            setError("Could not access camera. Please check permissions.");
            console.error(err);
        }
    }, [scanFrame]);

    if (loading || !student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
            </div>
        );
    }

    const isRestricted = student.status && ['graduated', 'dropped', 'transferred'].includes(student.status.toLowerCase());

    return (
        <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url}>
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <QrCode className="h-8 w-8 text-nwu-red" />
                        QR Scanner
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Securely record your attendance using the classroom QR code.
                    </p>
                </div>

                {/* Main Content Area */}
                {isRestricted ? (
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-red-100 dark:border-red-900/30 p-12 shadow-2xl text-center space-y-6">
                        <div className="w-24 h-24 rounded-[2rem] bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto shadow-xl">
                            <ShieldCheck className="h-10 w-10 text-nwu-red" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Access Restricted</h2>
                            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed text-balance">
                                QR Scanning is disabled because your account status is currently set to 
                                <span className="text-nwu-red font-bold uppercase mx-1">{(student.status || "UNKNOWN").toUpperCase()}</span>.
                                Please contact the Registrar for assistance.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push("/student/portal/dashboard")}
                            className="px-10 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-black hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm"
                        >
                            RETURN TO DASHBOARD
                        </button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-2xl relative overflow-hidden">
                        {/* Camera Container */}
                        <div className="relative aspect-square md:aspect-video bg-black rounded-3xl overflow-hidden shadow-inner ring-4 ring-gray-50 dark:ring-gray-800/50">
                            <video
                                ref={videoRef}
                                className={`w-full h-full object-cover ${scanning ? 'block' : 'hidden'}`}
                                playsInline
                                muted
                            />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Scanner Overlay UI */}
                            {scanning && (
                                <>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-64 h-64 border-2 border-nwu-red rounded-[2rem] relative shadow-[0_0_0_4000px_rgba(0,0,0,0.6)]">
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                                            
                                            {/* Scanning Line */}
                                            <div className="absolute left-4 right-4 h-[2px] bg-red-400 animate-[bounce_3s_ease-in-out_infinite] shadow-[0_0_15px_rgba(239,68,68,0.8)]" style={{ top: '50%' }} />
                                        </div>
                                    </div>
                                    <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Active Scan</span>
                                    </div>
                                    <button
                                        onClick={stopScanning}
                                        className="absolute bottom-6 right-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-xl border border-white/20 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}

                            {/* Idle State */}
                            {!scanning && !scanResult && !scanProcessing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-800/30 p-8 text-center">
                                    <div className="w-24 h-24 rounded-[2rem] bg-red-50 dark:bg-red-900/20 flex items-center justify-center shadow-xl shadow-red-200/50 dark:shadow-none animate-bounce duration-[3000ms]">
                                        <Camera className="h-10 w-10 text-nwu-red" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Ready to verify?</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-[240px]">
                                            Point your camera at the QR code shown by your instructor.
                                        </p>
                                    </div>
                                    <button
                                        onClick={startScanning}
                                        className="px-10 py-4 bg-nwu-red hover:bg-red-800 text-white rounded-2xl font-black transition-all flex items-center gap-3 shadow-2xl shadow-red-200 dark:shadow-none active:scale-95 group"
                                    >
                                        <QrCode className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                                        OPEN CAMERA
                                    </button>
                                    {error && (
                                        <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900/30">
                                            <AlertTriangle className="h-4 w-4" />
                                            {error}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Processing State */}
                            {scanProcessing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
                                    <Loader2 className="h-12 w-12 text-nwu-red animate-spin" />
                                    <div className="space-y-1 text-center">
                                        <p className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Authenticating</p>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Verifying session data...</p>
                                    </div>
                                </div>
                            )}

                            {/* Result State */}
                            {scanResult && (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300 ${
                                    scanResult.success 
                                    ? 'bg-green-50/95 dark:bg-green-900/20 backdrop-blur-md' 
                                    : 'bg-red-50/95 dark:bg-red-900/20 backdrop-blur-md'
                                }`}>
                                    <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl ${
                                        scanResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                    }`}>
                                        {scanResult.success ? <CheckCircle2 className="h-12 w-12" /> : <AlertTriangle className="h-12 w-12" />}
                                    </div>
                                    <h2 className={`text-2xl font-black tracking-tight mb-2 ${
                                        scanResult.success ? 'text-green-900 dark:text-green-400' : 'text-red-900 dark:text-red-400'
                                    }`}>
                                        {scanResult.success ? (scanResult.action === 'check_out' ? 'Checked Out!' : 'Attendance Logged!') : 'Scan Error'}
                                    </h2>
                                    <p className={`text-sm font-medium max-w-[280px] mb-8 ${
                                        scanResult.success ? 'text-green-700/80 dark:text-green-500' : 'text-red-700/80 dark:text-red-500'
                                    }`}>
                                        {scanResult.message}
                                    </p>
                                    <button
                                        onClick={() => setScanResult(null)}
                                        className={`px-10 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl ${
                                            scanResult.success 
                                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200' 
                                            : 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                                        }`}
                                    >
                                        {scanResult.success ? 'CONTINUE' : 'TRY AGAIN'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-start gap-3 border border-gray-100 dark:border-gray-800">
                                <Info className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">Protocol</h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                        Ensure the QR code is clearly visible and within the frame. Avoid glare and sudden movement.
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-start gap-3 border border-gray-100 dark:border-gray-800">
                                <ShieldCheck className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">Verification</h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                        Each scan is cryptographically signed and linked to your specific student identification.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </StudentLayout>
    );
}
