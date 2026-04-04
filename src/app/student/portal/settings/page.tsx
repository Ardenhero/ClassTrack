"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession, changeStudentPassword } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import {
    Lock,
    ShieldCheck,
    Loader2,
    AlertTriangle,
    Eye,
    EyeOff,
    CheckCircle2,
    Moon,
    Sun,
    Monitor
} from "lucide-react";
import { useTheme } from "next-themes";
import { PhotoUpload } from "@/components/PhotoUpload";

interface Student {
    id: string;
    name: string;
    sin: string;
    year_level?: string;
    image_url?: string;
}

export default function SettingsPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [showPasswords, setShowPasswords] = useState(false);
    const { theme, setTheme } = useTheme();
    const router = useRouter();

    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: ""
    });

    useEffect(() => {
        async function checkAuth() {
            const session = await getStudentSession();
            if (!session) {
                router.push("/student/portal");
                return;
            }
            setStudent(session);
            setLoading(false);
        }
        checkAuth();
    }, [router]);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);

        if (passwords.new !== passwords.confirm) {
            setMsg({ text: "New passwords do not match", type: "error" });
            return;
        }

        if (passwords.new.length < 6) {
            setMsg({ text: "Password must be at least 6 characters", type: "error" });
            return;
        }

        setUpdating(true);
        try {
            const formData = new FormData();
            formData.append("currentPassword", passwords.current);
            formData.append("newPassword", passwords.new);

            const result = await changeStudentPassword(formData);
            if (result.success) {
                setMsg({ text: "Password changed successfully!", type: "success" });
                setPasswords({ current: "", new: "", confirm: "" });
            } else {
                setMsg({ text: result.error || "Failed to change password", type: "error" });
            }
        } catch {
            setMsg({ text: "Network error", type: "error" });
        } finally {
            setUpdating(false);
        }
    };

    if (loading || !student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
            </div>
        );
    }

    return (
        <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url}>
            <div className="max-w-xl mx-auto space-y-12 py-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-widest uppercase">My Profile</h1>
                    <div className="h-1 w-12 bg-nwu-gold mx-auto rounded-full" />
                </div>

                {/* Profile Section */}
                <div className="flex flex-col items-center">
                    <div className="relative group mb-8">
                        <PhotoUpload
                            currentImageUrl={student.image_url}
                            tableName="students"
                            recordId={student.id}
                            uploadPath={`students/${student.sin}.jpg`}
                            size="lg"
                            hideInstructions={true}
                        />
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{student.name}</h2>
                        <p className="text-sm font-black text-nwu-red dark:text-red-400 uppercase tracking-[0.3em]">Student Account</p>
                    </div>
                </div>

                {/* Info List */}
                <div className="space-y-4">
                    <div className="space-y-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl">
                        <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Student SIN</span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">{student.sin}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Year Level</span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">{student.year_level || "Not Assigned"}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Current Status</span>
                            <span className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-black text-green-600 dark:text-green-500 italic uppercase">Active</span>
                            </span>
                        </div>
                    </div>

                    {/* Theme Switcher Card */}
                    <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl">
                        <div className="grid grid-cols-3 gap-3 p-1 bg-gray-50 dark:bg-gray-800/80 rounded-[2rem]">
                            <button
                                onClick={() => setTheme("light")}
                                aria-label="Switch to light theme"
                                className={`flex flex-col items-center gap-2 py-4 rounded-[1.5rem] transition-all duration-300 ${theme === "light" ? "bg-white dark:bg-gray-700 shadow-xl text-nwu-red scale-105" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                            >
                                <Sun className="h-5 w-5" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                aria-label="Switch to dark theme"
                                className={`flex flex-col items-center gap-2 py-4 rounded-[1.5rem] transition-all duration-300 ${theme === "dark" ? "bg-white dark:bg-gray-700 shadow-xl text-nwu-red scale-105" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                            >
                                <Moon className="h-5 w-5" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Dark</span>
                            </button>
                            <button
                                onClick={() => setTheme("system")}
                                aria-label="Use system theme"
                                className={`flex flex-col items-center gap-2 py-4 rounded-[1.5rem] transition-all duration-300 ${theme === "system" ? "bg-white dark:bg-gray-700 shadow-xl text-nwu-red scale-105" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                            >
                                <Monitor className="h-5 w-5" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Auto</span>
                            </button>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="bg-gray-900 dark:bg-black rounded-[3rem] p-8 shadow-2xl text-white">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                <Lock className="h-6 w-6 text-nwu-gold" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight uppercase">Update Password</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Secure your account</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-6">
                            {msg && (
                                <div className={`p-5 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 ${msg.type === "success"
                                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                                        : "bg-red-500/10 border-red-500/20 text-red-400"
                                    }`}>
                                    {msg.type === "success" ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                                    <p className="text-xs font-black tracking-wide uppercase">{msg.text}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="current-password" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Current Password</label>
                                    <div className="relative group">
                                        <input
                                            id="current-password"
                                            type={showPasswords ? "text" : "password"}
                                            value={passwords.current}
                                            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                            className="w-full pl-6 pr-14 py-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:ring-4 focus:ring-nwu-gold/20 focus:border-nwu-gold transition-all text-sm font-bold text-white placeholder-gray-600 outline-none"
                                            placeholder="Verification Required"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(!showPasswords)}
                                            aria-label={showPasswords ? "Hide current password" : "Show current password"}
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-nwu-gold transition-colors"
                                        >
                                            {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="new-password" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New Password</label>
                                        <input
                                            id="new-password"
                                            type={showPasswords ? "text" : "password"}
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:ring-4 focus:ring-nwu-gold/20 focus:border-nwu-gold transition-all text-sm font-bold text-white placeholder-gray-600 outline-none"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="confirm-password" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirm New</label>
                                        <input
                                            id="confirm-password"
                                            type={showPasswords ? "text" : "password"}
                                            value={passwords.confirm}
                                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:ring-4 focus:ring-nwu-gold/20 focus:border-nwu-gold transition-all text-sm font-bold text-white placeholder-gray-600 outline-none"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={updating || !passwords.current || !passwords.new}
                                className="w-full py-5 bg-white text-gray-950 hover:bg-nwu-gold hover:text-gray-950 disabled:opacity-30 rounded-[1.5rem] font-black transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-black/40"
                            >
                                {updating ? <Loader2 className="h-6 w-6 animate-spin text-gray-950" /> : <ShieldCheck className="h-6 w-6" />}
                                SAVE CHANGES
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="text-center pt-8 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => router.push("/student/portal/dashboard")}
                        className="text-[10px] font-black text-gray-400 dark:text-gray-500 hover:text-nwu-red transition-colors uppercase tracking-[0.4em]"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </StudentLayout>
    );
}
