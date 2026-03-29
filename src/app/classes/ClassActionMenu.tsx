"use client";

import { useState } from "react";
import { MoreVertical, Archive, Loader2 } from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { deleteClass } from "./actions";
import { useRouter } from "next/navigation";

export function ClassActionMenu({ classId }: { classId: string }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    const handleArchive = async () => {
        setDeleting(true);
        setIsConfirmOpen(false);
        await deleteClass(classId);
        setDeleting(false);
        router.push("/classes");
    };

    return (
        <div className="relative inline-block text-left" onMouseLeave={() => setMenuOpen(false)}>
            <button
                type="button"
                className="flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 focus:outline-none"
                onClick={() => setMenuOpen(!menuOpen)}
            >
                <MoreVertical className="h-5 w-5" />
            </button>

            {menuOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                        <button
                            onClick={() => {
                                setMenuOpen(false);
                                setIsConfirmOpen(true);
                            }}
                            disabled={deleting}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
                            Archive Class
                        </button>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleArchive}
                title="Archive Class"
                message="Archive this class? It can be restored later from the Archived page."
                variant="warning"
                confirmLabel="Archive"
            />
        </div>
    );
}
