"use client";

import { useState } from "react";
import { CalendarOff, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { declareNoClass } from "@/app/notifications/actions";

interface MarkNoClassButtonProps {
    classId: string;
    className: string;
    date: string;
    instructorId: string;
    existingOverride?: { id: string; type: string; note: string } | null;
}

const overrideTypes = [
    { value: "holiday", label: "🏖 Holiday", desc: "National or university holiday" },
    { value: "cancelled", label: "🚫 Cancelled", desc: "Class cancelled by instructor" },
    { value: "suspended", label: "⚠️ Suspended", desc: "University-wide class suspension" },
];

export default function MarkNoClassButton({ classId, className, date, instructorId, existingOverride }: MarkNoClassButtonProps) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState("holiday");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const result = await declareNoClass({
                classId,
                className,
                date,
                type,
                note,
                instructorId
            });

            if (result.error) {
                alert("Failed to save: " + result.error);
            } else {
                setOpen(false);
                router.refresh();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!existingOverride) return;
        setIdToDelete(existingOverride.id);
        setConfirmOpen(true);
    };

    const confirmRemove = async () => {
        if (!idToDelete) return;
        setRemoving(true);
        try {
            const { error } = await supabase.from("class_day_overrides").delete().eq("id", idToDelete);
            if (error) {
                alert("Failed to remove: " + error.message);
                setConfirmOpen(false);
            } else {
                router.refresh();
                // We keep it open for a tiny bit to avoid flickering before refresh takes effect
                setTimeout(() => {
                    setConfirmOpen(false);
                    setIdToDelete(null);
                }, 100);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            alert("An error occurred: " + errorMsg);
            setConfirmOpen(false);
        } finally {
            setRemoving(false);
        }
    };

    const typeLabel = existingOverride 
        ? (overrideTypes.find(t => t.value === existingOverride.type)?.label || existingOverride.type)
        : "";

    return (
        <>
            {existingOverride ? (
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                        {typeLabel}{existingOverride.note ? ` — ${existingOverride.note}` : ""}
                    </span>
                    <button
                        onClick={handleRemove}
                        disabled={removing}
                        className="p-1 px-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md transition-all active:scale-90"
                        title="Remove marker"
                    >
                        {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1.5 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/40"
                    title="Mark this day as no class (holiday, cancelled, etc.)"
                >
                    <CalendarOff className="h-3.5 w-3.5" />
                    No Class
                </button>
            )}

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Mark as No Class</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            This date will be excluded from attendance calculations and absent notifications.
                        </p>

                        <div className="space-y-2 mb-4">
                            {overrideTypes.map(t => (
                                <label key={t.value} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${type === t.value
                                    ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
                                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                                    }`}>
                                    <input
                                        type="radio"
                                        name="override-type"
                                        value={t.value}
                                        checked={type === t.value}
                                        onChange={() => setType(t.value)}
                                        className="sr-only"
                                    />
                                    <div>
                                        <div className="font-medium text-sm">{t.label}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Optional note (e.g., 'EDSA Anniversary')"
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 mb-4"
                        />

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={confirmOpen}
                onClose={() => !removing && setConfirmOpen(false)}
                onConfirm={confirmRemove}
                title="Remove Marker"
                message="Remove the holiday/no-class marker for this date? This will restore normal attendance tracking for this day."
                variant="danger"
                isLoading={removing}
            />
        </>
    );
}
