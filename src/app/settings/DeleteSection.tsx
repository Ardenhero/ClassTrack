"use client";

import { useState } from "react";
import { deleteAccount, deleteProfile } from "./actions";

// Define prop types
interface DeleteSectionProps {
    role: string | null;
}

export function DeleteSection({ role }: DeleteSectionProps) {
    return (
        <section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/20 p-6">
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
            
            {role === 'admin' ? (
                <>
                    <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">
                        Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <DeleteButton 
                        action={deleteAccount} 
                        label="Delete Account" 
                        confirmMsg="Are you sure you want to delete your ENTIRE ACCOUNT? This cannot be undone." 
                    />
                </>
            ) : (
                <>
                    <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">
                        Delete your instructor profile data. Only System Admins can delete the account itself.
                    </p>
                    <DeleteButton 
                        action={deleteProfile} 
                        label="Delete Profile" 
                        confirmMsg="Are you sure you want to delete your profile? This will remove your classes and data." 
                    />
                </>
            )}
        </section>
    );
}

function DeleteButton({ 
    action, 
    label, 
    confirmMsg 
}: { 
    action: () => Promise<any>, 
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
