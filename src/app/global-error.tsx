'use client';

import { useEffect } from 'react';
// import { logger } from "@/lib/logger";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error
        // Note: logger.error in client side might fall back to console in some configs, 
        // but here it handles pretty printing.
        console.error("Global Error Caught:", error);
    }, [error]);

    return (
        <html>
            <body className="bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        A critical error occurred. Our team has been notified.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="w-full bg-nwu-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
