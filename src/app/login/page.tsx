"use client";

import { useState } from "react";
import { Loader2, QrCode } from "lucide-react";
import Image from "next/image";
import { login, signup } from "./actions";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isSignUp] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setMessage(null);

        const formData = new FormData(event.currentTarget);
        const action = isSignUp ? signup : login;

        // Server actions return plain objects or void
        const result = await action(formData);

        if (result && typeof result === 'object' && 'error' in result && result.error) {
            setMessage(result.error);
        } else if (isSignUp && result && 'pending' in result) {
            setMessage("Success! Your account has been created and is pending admin approval. You'll be notified once approved.");
        } else if (isSignUp) {
            setMessage("Success! Your account has been created. You can now use it to log in.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-nu-500/20 via-dark-bg to-dark-bg">
            {/* Ambient Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-nu-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-nu-400/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            {/* University Header */}
            <header className="w-full p-4 relative z-10">
                <div className="max-w-7xl mx-auto glass-panel rounded-2xl px-6 py-4 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-white/10">
                    {/* Left Logo: NWU Seal */}
                    <div className="flex-shrink-0 relative group cursor-pointer">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:bg-white/40 transition-all duration-500"></div>
                        <Image
                            src="/branding/nwu_seal.png"
                            alt="Northwestern University Seal"
                            width={80}
                            height={80}
                            className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full border-2 border-white/20 bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)] relative z-10 transform group-hover:scale-105 transition-transform duration-500"
                        />
                    </div>

                    {/* Center Text */}
                    <div className="flex-grow text-center px-4">
                        <h1 className="text-white font-serif font-bold text-xl md:text-3xl tracking-wide uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                            Northwestern University
                        </h1>
                        <p className="text-nwu-gold text-xs md:text-sm font-bold tracking-[0.2em] uppercase mt-1 drop-shadow-md opacity-90">
                            Laoag City, Philippines
                        </p>
                    </div>

                    {/* Right Logo: ICPEP */}
                    <div className="flex-shrink-0 relative group cursor-pointer">
                        <div className="absolute inset-0 bg-white/10 rounded-full blur-md group-hover:bg-white/30 transition-all duration-500"></div>
                        <Image
                            src="/branding/icpep_logo.png"
                            alt="ICPEP Logo"
                            width={80}
                            height={80}
                            className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full border-2 border-white/20 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)] relative z-10 transform group-hover:scale-105 transition-transform duration-500 p-1"
                        />
                    </div>
                </div>
            </header>

            {/* Login Content */}
            <div className="flex-grow flex items-center justify-center p-4 relative z-10">
                <div className="max-w-md w-full space-y-8 p-10 glass-card rounded-2xl shadow-[0_0_80px_rgba(176,42,42,0.15)] relative overflow-hidden group/card transform transition-all hover:shadow-[0_0_100px_rgba(176,42,42,0.25)]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nu-500 to-transparent opacity-50"></div>

                    <div className="text-center relative z-10">
                        <div className="inline-flex items-center justify-center p-3 glass-panel rounded-2xl mb-4 shadow-glow-red/50">
                            <QrCode className="w-8 h-8 text-nu-400 drop-shadow-[0_0_8px_rgba(176,42,42,0.8)]" />
                        </div>
                        <h2 className="mt-2 text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                            {isSignUp ? "Create Account" : "System Access"}
                        </h2>
                        <p className="mt-2 text-sm text-gray-400 font-medium">
                            {isSignUp ? "Register to start tracking attendance" : "Enter your credentials to access the dashboard"}
                        </p>
                    </div>

                    {message && (
                        <div className={`border px-4 py-3 rounded-xl relative text-sm font-medium shadow-inner ${message.includes("Success") ? "bg-green-500/10 border-green-500/20 text-green-400 shadow-[inset_0_1px_2px_rgba(34,197,94,0.1)]" : "bg-red-500/10 border-red-500/20 text-red-400 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)]"}`}>
                            {message}
                        </div>
                    )}

                    <form className="mt-8 space-y-6 relative z-10" onSubmit={handleSubmit}>
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="email-address" className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Email address
                                </label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="glass-input h-11"
                                    placeholder="Enter your email"
                                    data-testid="email-input"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="glass-input h-11 pointer-events-auto"
                                    placeholder="Enter your password"
                                    data-testid="password-input"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold tracking-widest uppercase rounded-xl text-white bg-nu-500 hover:bg-nu-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nu-500 focus:ring-offset-dark-bg disabled:opacity-50 transition-all duration-300 shadow-glow-red hover:shadow-[0_0_25px_rgba(176,42,42,0.8)] hover:scale-[1.02] active:scale-95 overflow-hidden"
                                data-testid="sign-in-button"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                                <span className="relative z-10 flex items-center justify-center">
                                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isSignUp ? "SIGN UP" : "SIGN IN")}
                                </span>
                            </button>
                        </div>
                    </form>

                    <div className="text-center mt-6 relative z-10">
                        <p className="text-xs text-gray-500 italic">
                            System access is strictly <span className="text-nu-400 font-bold tracking-wide">Invite-Only</span>.
                            If you require an account, please contact the University IT Department.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 pt-6 border-t border-white/5 relative z-10">
                        <a
                            href="/student/portal"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 bg-white/[0.02] border border-white/10 rounded-xl hover:bg-white/[0.05] hover:text-nu-400 hover:border-nu-500/30 hover:shadow-[0_0_15px_rgba(176,42,42,0.15)] transition-all duration-300 w-full"
                        >
                            <QrCode className="w-4 h-4" />
                            Student Portal
                        </a>
                    </div>

                </div>
            </div>

            {/* Footer */}
            <footer className="py-6 text-center text-xs text-gray-500 font-medium tracking-wide relative z-10">
                &copy; {new Date().getFullYear()} Northwestern University Attendance System. <span className="opacity-75">All rights reserved.</span>
            </footer>
        </div>
    );
}
