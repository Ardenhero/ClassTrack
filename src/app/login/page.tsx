"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* University Header */}
            <header className="bg-nwu-red w-full py-4 px-4 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left Logo: NWU Seal */}
                    <div className="flex-shrink-0">
                        <Image
                            src="/branding/nwu_seal.png"
                            alt="Northwestern University Seal"
                            width={80}
                            height={80}
                            className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full border-2 border-white bg-white"
                        />
                    </div>

                    {/* Center Text */}
                    <div className="flex-grow text-center px-4">
                        <h1 className="text-white font-serif font-bold text-xl md:text-3xl tracking-wide uppercase drop-shadow-sm">
                            Northwestern University
                        </h1>
                        <p className="text-nwu-gold text-xs md:text-sm font-medium tracking-wider uppercase mt-1">
                            Laoag City, Philippines
                        </p>
                    </div>

                    {/* Right Logo: ICPEP */}
                    <div className="flex-shrink-0">
                        <Image
                            src="/branding/icpep_logo.png"
                            alt="ICPEP Logo"
                            width={80}
                            height={80}
                            className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full border-2 border-white bg-white/10"
                        />
                    </div>
                </div>
            </header>

            {/* Login Content */}
            <div className="flex-grow flex items-center justify-center p-4">
                <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-xl border-t-4 border-nwu-gold">
                    <div className="text-center">
                        <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
                            {isSignUp ? "Create Account" : "Attendance System Login"}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            {isSignUp ? "Register to start tracking attendance" : "Enter your credentials to access the dashboard"}
                        </p>
                    </div>

                    {message && (
                        <div className={`border px-4 py-3 rounded relative text-sm ${message.includes("Success") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                            {message}
                        </div>
                    )}

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email address
                                </label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-nwu-red focus:border-nwu-red sm:text-sm transition-colors"
                                    placeholder="Enter your email"
                                    data-testid="email-input"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-nwu-red focus:border-nwu-red sm:text-sm transition-colors"
                                    placeholder="Enter your password"
                                    data-testid="password-input"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-md text-white bg-nwu-red hover:bg-[#5e0d0e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nwu-red disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                                data-testid="sign-in-button"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isSignUp ? "SIGN UP" : "SIGN IN")}
                            </button>
                        </div>
                    </form>

                    <div className="text-center mt-6">
                        <p className="text-sm text-gray-500 italic">
                            System access is strictly <span className="text-nwu-red font-bold">Invite-Only</span>.
                            If you require an account, please contact the University IT Department.
                        </p>
                    </div>

                    <div className="text-center mt-4 pt-4 border-t border-gray-200">
                        <a
                            href="/submit-evidence"
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 bg-transparent border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-nwu-red hover:border-nwu-red/30 transition-all duration-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 18v-6" /><path d="m9 15 3-3 3 3" /></svg>
                            Student? Submit an Excuse Letter
                        </a>
                    </div>

                </div>
            </div>

            {/* Footer */}
            <footer className="py-4 text-center text-xs text-gray-400">
                &copy; {new Date().getFullYear()} Northwestern University Attendance System. All rights reserved.
            </footer>
        </div>
    );
}
