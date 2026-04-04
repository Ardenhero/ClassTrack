"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, AlertTriangle, KeyRound, Search, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { loginStudent, getStudentSession } from "./actions";

export default function LoginPage() {
    const [sin, setSin] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();

    // Check for existing session
    useEffect(() => {
        const checkSession = async () => {
            const session = await getStudentSession();
            if (session) {
                router.push("/student/portal/dashboard");
            } else {
                setIsChecking(false);
            }
        };
        checkSession();
    }, [router]);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!sin.trim() || !password) return;

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("sin", sin);
            formData.append("password", password);

            const result = await loginStudent(formData);

            if (result.success) {
                router.push("/student/portal/dashboard");
                router.refresh();
            } else {
                setError(result.error || "Login failed");
                setLoading(false);
            }
        } catch {
            setError("Network error. Please try again.");
            setLoading(false);
        }
    };

    if (isChecking) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 dark:bg-gray-950">
                <Loader2 className="h-8 w-8 text-nwu-red dark:text-nwu-red-light animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Securing connection...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 md:p-8 dark:bg-gray-950">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-6 animate-in zoom-in duration-500">
                        <Image
                            src="/branding/student_logo_hd.png"
                            alt="ClassTrack Logo"
                            width={112}
                            height={112}
                            sizes="112px"
                            className="w-full h-full object-contain rounded-full scale-[1.2]"
                        />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Student Portal</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">ClassTrack Verification System v3.3</p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Secure Login
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Enter your credentials to access your dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-2xl border border-red-100 dark:border-red-800 flex items-center gap-3 animate-shake">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <p className="font-semibold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="student-sin" className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Student ID (SIN)</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-nwu-red dark:group-focus-within:text-nwu-red-light transition-colors">
                                    <Search className="h-5 w-5" />
                                </div>
                                <input
                                    id="student-sin"
                                    type="text"
                                    value={sin}
                                    onChange={(e) => setSin(e.target.value)}
                                    placeholder="22-00000"
                                    className="w-full pl-11 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all font-mono font-bold tracking-wider"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="student-password" className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-nwu-red dark:group-focus-within:text-nwu-red-light transition-colors">
                                    <KeyRound className="h-5 w-5" />
                                </div>
                                <input
                                    id="student-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-11 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                    required
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
                                Default password is your SIN for first-time login.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !sin.trim() || !password}
                            className="w-full py-4 rounded-2xl bg-nwu-red hover:bg-red-800 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-200 dark:shadow-none active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                            {loading ? "Authenticating..." : "Access Portal"}
                        </button>

                        <Link
                            href="/login"
                            className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            GO BACK
                        </Link>
                    </form>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-600 font-medium">
                        © 2026 ClassTrack • NWU ICPEP.SE
                    </p>
                </div>
            </div>
        </div>
    );
}
