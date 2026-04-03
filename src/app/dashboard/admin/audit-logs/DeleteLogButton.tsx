"use client";

import { deleteAuditLog } from "../provisioning/actions";
import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

export function DeleteLogButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this audit log entry? This action is permanent.")) return;
        setLoading(true);
        try {
            await deleteAuditLog(id);
        } catch (err) {
            alert("Failed to delete log");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 disabled:opacity-50"
            title="Delete log entry"
        >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.3 w-3.5" />}
        </button>
    );
}
