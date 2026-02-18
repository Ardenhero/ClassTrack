"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/utils/cn";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
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
    if (!isOpen) return null;

    const colors = {
        danger: {
            icon: "text-red-600 bg-red-100",
            button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
            border: "border-red-200"
        },
        warning: {
            icon: "text-amber-600 bg-amber-100",
            button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
            border: "border-amber-200"
        },
        info: {
            icon: "text-blue-600 bg-blue-100",
            button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
            border: "border-blue-200"
        }
    };

    const theme = colors[variant];

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm transition-opacity">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all sm:my-8 border border-gray-100 dark:border-gray-700">

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="sm:flex sm:items-start">
                    <div className={cn(
                        "mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10",
                        theme.icon
                    )}>
                        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                        <h3 className="text-lg font-bold leading-6 text-gray-900 dark:text-white">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 sm:flex sm:flex-row-reverse gap-3">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "inline-flex w-full justify-center rounded-xl px-3 py-3 text-sm font-bold text-white shadow-sm sm:w-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                            theme.button
                        )}
                    >
                        {isLoading ? "Processing..." : confirmLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="mt-3 inline-flex w-full justify-center rounded-xl bg-white dark:bg-gray-800 px-3 py-3 text-sm font-bold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 sm:mt-0 sm:w-auto transition-all"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
