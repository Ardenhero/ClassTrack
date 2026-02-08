'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Segment Error:', error);
    }, [error]);

    return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
            <div className="text-center max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Unable to load this section
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    {error.message || "An unexpected error occurred while loading this content."}
                </p>
                <button
                    onClick={() => reset()}
                    className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Try again
                </button>
            </div>
        </div>
    );
}
