"use client";

import { useState } from "react";
import { CalendarOff, Loader2, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeclareHolidayButtonProps {
    selectedDate: string;
}

const holidayTypes = [
    { value: "holiday", label: "🏖 Holiday", desc: "National or university holiday" },
    { value: "suspended", label: "⚠️ Suspended Classes", desc: "Weather, emergency, etc." },
];

export default function DeclareHolidayButton({ selectedDate }: DeclareHolidayButtonProps) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState("holiday");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);
    const router = useRouter();

    const handleSubmit = async () => {
        if (!confirm(
            `Declare ${type === 'holiday' ? 'Holiday' : 'Suspended Classes'} for ${selectedDate}?\n\n` +
            `This will mark ALL active classes as "No Class" for this date.`
        )) return;

        setLoading(true);
        try {
            const res = await fetch("/api/attendance/bulk-holiday", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: selectedDate, type, note: note || null }),
            });

            const data = await res.json();
            if (res.ok) {
                setResult({ success: true, count: data.classesAffected });
                setOpen(false);
                router.refresh();
            } else {
                alert("Failed: " + data.error);
            }
        } finally {
            setLoading(false);
        }
    };

    if (result?.success) {
        return (
            <div className="px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-100 rounded-lg flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Holiday declared ({result.count} classes)
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1.5 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                title="Declare holiday for ALL classes on this date"
            >
                <CalendarOff className="h-3.5 w-3.5" />
                Declare Holiday
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Declare Holiday</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            Date: <span className="font-semibold text-gray-700 dark:text-gray-200">{selectedDate}</span>
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                            ⚠️ This marks ALL active classes as &ldquo;No Class&rdquo; for this date.
                        </p>

                        <div className="space-y-2 mb-4">
                            {holidayTypes.map(t => (
                                <label key={t.value} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${type === t.value
                                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
                                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                                    }`}>
                                    <input
                                        type="radio"
                                        name="holiday-type"
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
                            placeholder="Note (e.g., 'EDSA Anniversary')"
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
                                Declare for All Classes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
