import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="text-center">
                <div className="inline-block p-6 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
                    <FileQuestion className="h-12 w-12 text-gray-400" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
                    Page Not Found
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
                    The page you are looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-nwu-gold text-nwu-blue rounded-xl font-bold hover:scale-105 transition-transform"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
