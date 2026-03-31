"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";
import { requestAccountDeletion } from "../dashboard/admin/provisioning/actions";
import { Trash2, UserX } from "lucide-react";
import { ConfirmationModal } from "../../components/ConfirmationModal";

interface DeleteSectionProps {
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export function DeleteSection({ isAdmin, isSuperAdmin }: DeleteSectionProps) {
    const [isPending, setIsPending] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteReason, setDeleteReason] = useState("");
    const [requestPending, setRequestPending] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { }
    });

    async function handleRequestDeletion() {
        if (!deleteReason.trim()) {
            alert("Please provide a reason for account deletion.");
            return;
        }

        setConfirmConfig({
            isOpen: true,
            title: "Request Deletion",
            message: "Are you sure you want to request permanent account deletion? This will be reviewed by the Super Admin.",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setRequestPending(true);
                try {
                    await requestAccountDeletion(deleteReason);
                    setShowDeleteModal(false);
                    setDeleteReason("");
                    alert("Your deletion request has been submitted. The Super Admin will review it.");
                } catch (err) {
                    alert(err instanceof Error ? err.message : "Failed to submit request");
                }
                setRequestPending(false);
            }
        });
    }

    // Instructors see nothing in the Danger Zone (managed by admins)
    if (!isAdmin && !isSuperAdmin) {
        return null;
    }

    // Super Admins: Direct Delete Account
    if (isSuperAdmin) {
        return (
            <section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/20 p-6">
                <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
                <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">
                    Permanently delete your entire account record and all associated data.
                </p>
                <button
                    onClick={() => {
                        setConfirmConfig({
                            isOpen: true,
                            title: "Delete Account",
                            message: "Are you sure? This will PERMANENTLY delete your account. This action cannot be undone.",
                            onConfirm: async () => {
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                setIsPending(true);
                                const res = await deleteAccount();
                                if (res?.error) {
                                    alert(res.error);
                                    setIsPending(false);
                                }
                            }
                        });
                    }}
                    disabled={isPending}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    <Trash2 className="h-4 w-4" />
                    {isPending ? "Deleting..." : "Delete Account"}
                </button>
            </section>
        );
    }

    // Department Admins: Request Deletion
    return (
        <>
            <section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/20 p-6">
                <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
                <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">
                    Permanently delete your account. This requires approval from the Super Admin.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-md text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                        <UserX className="h-4 w-4" />
                        Request Account Deletion
                    </button>
                </div>
            </section>

            {/* Deletion Request Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-xl">
                                <Trash2 className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Request Account Deletion</h3>
                                <p className="text-xs text-gray-500">Requires Super Admin approval</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reason *</label>
                                <textarea
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="Why do you want to delete your account?"
                                    className="w-full mt-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowDeleteModal(false); setDeleteReason(""); }}
                                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestDeletion}
                                    disabled={requestPending}
                                    className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                                >
                                    {requestPending ? "Submitting..." : "Submit Request"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant="danger"
            />
        </>
    );
}
