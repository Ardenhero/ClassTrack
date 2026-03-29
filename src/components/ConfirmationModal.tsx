"use client";

import { AlertTriangle, X, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";
import { useEffect, useState } from "react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info" | "success";
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "warning",
    isLoading = false
}: ConfirmationModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setMounted(false), 200);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !mounted) return null;

    const colors = {
        danger: {
            icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
            iconBg: "bg-red-500/10 border-red-500/20",
            button: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-500/25",
            accent: "from-red-500/10 to-transparent"
        },
        warning: {
            icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
            iconBg: "bg-amber-500/10 border-amber-500/20",
            button: "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-amber-500/25",
            accent: "from-amber-500/10 to-transparent"
        },
        info: {
            icon: <Info className="h-6 w-6 text-blue-500" />,
            iconBg: "bg-blue-500/10 border-blue-500/20",
            button: "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-blue-500/25",
            accent: "from-blue-500/10 to-transparent"
        },
        success: {
            icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
            iconBg: "bg-emerald-500/10 border-emerald-500/20",
            button: "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-500/25",
            accent: "from-emerald-500/10 to-transparent"
        }
    };

    const theme = colors[variant];

    return (
        <div
            className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-out",
                isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
        >
            {/* Backdrop with Glassmorphism */}
            <div
                className="absolute inset-0 bg-gray-950/40 backdrop-blur-md"
                onClick={!isLoading ? onClose : undefined}
            />

            {/* Modal Container */}
            <div
                className={cn(
                    "relative w-full max-w-md transform overflow-hidden rounded-[24px] bg-white dark:bg-[#1a1c1e] p-8 shadow-2xl transition-all duration-300 border border-gray-200 dark:border-white/5",
                    isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}
            >
                {/* Visual Accent */}
                <div className={cn("absolute -top-24 -right-24 h-48 w-48 bg-gradient-to-br rounded-full blur-3xl opacity-30 pointer-events-none", theme.accent)}></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all active:scale-90 disabled:opacity-0"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="relative">
                    {/* Icon section */}
                    <div className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-2xl border mb-6 transition-transform duration-500",
                        theme.iconBg,
                        isOpen ? "scale-100 rotate-0" : "scale-50 rotate-12"
                    )}>
                        {theme.icon}
                    </div>

                    {/* Content Section */}
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-tight mb-2 uppercase italic tracking-wider">
                            {title}
                        </h3>
                        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                            {message}
                        </p>
                    </div>

                    {/* Actions Section */}
                    <div className="mt-10 flex flex-col sm:flex-row-reverse gap-3">
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={cn(
                                "relative inline-flex flex-1 items-center justify-center rounded-xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden uppercase tracking-widest italic",
                                theme.button
                            )}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    confirmLabel
                                )}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="inline-flex flex-1 justify-center rounded-xl bg-gray-50 dark:bg-white/5 px-6 py-3.5 text-sm font-black text-gray-900 dark:text-gray-300 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest italic"
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

