import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function AuthCodeError() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Authentication Error
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        There was a problem signing you in. This usually happens if:
                    </p>
                    <ul className="mt-4 text-sm text-gray-500 text-left list-disc pl-5 space-y-2">
                        <li>The sign-in link has expired.</li>
                        <li>You cancelled the login process.</li>
                        <li>The authentication provider (Google) is not enabled in Supabase.</li>
                    </ul>
                </div>
                <div className="mt-6">
                    <Link
                        href="/login"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Return to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
