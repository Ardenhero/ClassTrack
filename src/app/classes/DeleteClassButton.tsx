"use client";

import { Archive } from "lucide-react";
import { deleteClass } from "./actions";
import { useState } from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";

export function DeleteClassButton({ id }: { id: string }) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const handleDelete = async () => {
        setIsConfirmOpen(false);
        await deleteClass(id);
    };

    return (
        <>
            <button
                onClick={() => setIsConfirmOpen(true)}
                className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
                title="Archive Class"
            >
                <Archive className="h-4 w-4" />
            </button>

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Archive Class"
                message="Archive this class? It can be restored later from the Archived page."
                variant="warning"
                confirmLabel="Archive"
            />
        </>
    );
}
