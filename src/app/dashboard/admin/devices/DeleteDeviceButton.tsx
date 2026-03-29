"use client";

import { Trash2 } from "lucide-react";
import { deleteDevice } from "./actions";
import { useState } from "react";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

export function DeleteDeviceButton({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Device",
            message: `Are you sure you want to permanently delete "${deviceName}"? This cannot be undone.`,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setDeleting(true);
                const result = await deleteDevice(deviceId);
                if (result && !result.success) {
                    alert(`Failed to delete: ${result.error}`);
                }
                setDeleting(false);
            }
        });
    };

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "danger"
    });

    return (
        <>
            <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title={`Delete ${deviceName}`}
            >
                <Trash2 className={`h-4 w-4 ${deleting ? "animate-spin" : ""}`} />
            </button>
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
