"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";

interface PinVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    instructorId: string;
    title?: string;
    description?: string;
}

export function PinVerificationModal({
    isOpen,
    onClose,
    onSuccess,
    instructorId,
    title = "Security Verification",
    description = "Enter your 4-digit PIN to continue"
}: PinVerificationModalProps) {
    const [pin, setPin] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerifyPin = async () => {
        setVerifying(true);
        setError(null);

        try {
            const res = await fetch("/api/auth/verify_pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instructor_id: instructorId, pin }),
            });

            const result = await res.json();
            if (result.success) {
                onSuccess();
                setPin("");
            } else {
                setError(result.error || "Verification failed");
                setPin("");
            }
        } catch (err) {
            console.error("PIN verification error:", err);
            setError("An unexpected error occurred.");
        } finally {
            setVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all">
                <div className="bg-nwu-red p-6 text-white shrink-0">
                    <div className="mx-auto bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                        <Lock className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-center uppercase tracking-wide">{title}</h2>
                    <p className="text-xs opacity-80 mt-1 text-center">{description}</p>
                </div>

                <div className="p-6">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Enter PIN</label>
                            <input
                                type="password"
                                maxLength={4}
                                value={pin}
                                onChange={(e) => {
                                    setPin(e.target.value.replace(/\D/g, ""));
                                    setError(null);
                                }}
                                autoFocus
                                className="w-full text-center text-3xl tracking-[0.5em] font-mono px-4 py-3 border-b-2 border-gray-200 dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-nwu-red transition-colors bg-transparent"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium text-center animate-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setPin("");
                                    setError(null);
                                    onClose();
                                }}
                                className="flex-1 px-4 py-3 text-sm font-bold text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleVerifyPin}
                                disabled={pin.length < 4 || verifying}
                                className="flex-1 px-4 py-3 bg-nwu-red text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center"
                            >
                                {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "VERIFY"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
