"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";

// Define prop types
interface DeleteSectionProps {
    role: string | null;
}

export function DeleteSection({ role }: DeleteSectionProps) {
    // PRODUCTION HARDENING: Instructors cannot self-delete
    if (role !== 'admin') {
        return (
            <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">Account Management</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Profile and account deletion is managed by your System Administrator. Contact your department admin if changes are needed.
                </p>
            </section>
        );
    }

    return (
        <section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/20 p-6">
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">
                Once you delete your account, there is no going back. Please be certain.
            </p>
            <DeleteButton
                action={deleteAccount}
                label="Delete Account"
                confirmMsg="Are you sure you want to delete your ENTIRE ACCOUNT? This cannot be undone."
            />
        </section>
    );
}

function DeleteButton({
    action,
    label,
    confirmMsg
}: {
    action: () => Promise<void | { error?: string }>,
    label: string,
    confirmMsg: string
}) {
    const [isPending, setIsPending] = useState(false);

    async function handleDelete() {
        if (!confirm(confirmMsg)) {
            return;
        }

        setIsPending(true);
        const result = await action();

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
            {isPending ? "Deleting..." : label}
        </button>
    );
}
