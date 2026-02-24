"use client";

import { Trash2, Archive, X } from "lucide-react";
import { useState } from "react";

interface MultiDeleteBarProps {
    count: number;
    itemLabel: string;
    onDelete: () => Promise<void>;
    onClear: () => void;
    actionLabel?: string; // "Archive" or "Delete" — defaults to "Delete"
}

export function MultiDeleteBar({ count, itemLabel, onDelete, onClear, actionLabel }: MultiDeleteBarProps) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    if (count === 0) return null;

    const handleDelete = async () => {
        setDeleting(true);
        await onDelete();
        setDeleting(false);
        setConfirming(false);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 border border-gray-700">
                <span className="text-sm font-medium">
                    <span className="text-nwu-gold font-bold">{count}</span> {itemLabel} selected
                </span>

                {!confirming ? (
                    <>
                        <button
                            onClick={() => setConfirming(true)}
                            className={`px-4 py-1.5 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 ${actionLabel === "Archive" ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}`}
                        >
                            {actionLabel === "Archive" ? <Archive className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                            {actionLabel || "Delete"} Selected
                        </button>
                        <button
                            onClick={onClear}
                            className="p-1.5 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <span className="text-xs text-red-400">Are you sure?</span>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="px-4 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                            {deleting ? (actionLabel === "Archive" ? "Archiving..." : "Deleting...") : "Confirm"}
                        </button>
                        <button
                            onClick={() => setConfirming(false)}
                            className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
