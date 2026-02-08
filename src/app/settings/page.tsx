"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { ModeToggle } from "@/components/ModeToggle";
import { Fingerprint } from "lucide-react";
import { deleteAccount } from "./actions";
import { useState } from "react";

export default function SettingsPage() {
    return (
        <DashboardLayout>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

            <div className="space-y-8">
                {/* Appearance Section */}
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appearance</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Theme Mode</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark themes</p>
                        </div>
                        <ModeToggle />
                    </div>
                </section>



                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Hardware Info</h2>
                    <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <Fingerprint className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Biometric Terminal #1</p>
                            <p className="text-sm text-green-600">Online • Firmware v2.1.0</p>
                        </div>
                    </div>
                </section>

                <section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/20 p-6">
                    <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
                    <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">
                        Once you delete your account, there is no going back. Please be certain.
                    </p>

                    <DeleteAccountButton />
                </section>
            </div>
        </DashboardLayout>
    );
}

function DeleteAccountButton() {
    const [isPending, setIsPending] = useState(false);

    async function handleDelete() {
        if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
            return;
        }

        setIsPending(true);
        const result = await deleteAccount();

        if (result?.error) {
            alert(result.error);
            setIsPending(false);
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center"
        >
            {isPending ? "Deleting..." : "Delete Account"}
        </button>
    );
}

export const dynamic = 'force-dynamic';
