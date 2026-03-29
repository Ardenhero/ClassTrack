"use client";

import { useState, useMemo, useEffect } from "react";
import { CalendarOff, Loader2, X, CheckCircle2, CheckSquare, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { declareNoClass } from "../../app/notifications/actions";

interface GlobalNoClassDialogProps {
    isOpen: boolean;
    onClose: () => void;
    instructorId: string;
    classes: { id: string; name: string; schedule_days: string; term_id: string }[];
}

const overrideTypes = [
    { value: "holiday", label: "🏖 Holiday", desc: "National or university holiday" },
    { value: "cancelled", label: "🚫 Cancelled", desc: "Class cancelled by instructor" },
    { value: "suspended", label: "⚠️ Suspended", desc: "University-wide class suspension" },
];

export function GlobalNoClassDialog({ isOpen, onClose, instructorId, classes }: GlobalNoClassDialogProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState("holiday");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    // Helper to check if a class is scheduled for the selected date
    const isScheduledOn = (schedule: string, dateStr: string) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDate = new Date(dateStr);
        const dayName = days[selectedDate.getDay()].toLowerCase();
        const sched = schedule.toLowerCase();
        
        return sched.includes(dayName) || 
               (dayName === 'thu' && sched.includes('thurs')) || 
               (dayName === 'wed' && sched.includes('weds'));
    };

    const filteredClasses = useMemo(() => 
        classes.filter(c => isScheduledOn(c.schedule_days, date)),
    [classes, date]);

    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

    // Auto-select all filtered classes on date change or mount if empty
    useEffect(() => {
        if (filteredClasses.length > 0) {
            setSelectedClassIds(filteredClasses.map(c => c.id));
        } else {
            setSelectedClassIds([]);
        }
    }, [date, filteredClasses]);

    if (!isOpen) return null;

    const toggleClass = (id: string) => {
        if (selectedClassIds.includes(id)) {
            setSelectedClassIds(prev => prev.filter(cId => cId !== id));
        } else {
            setSelectedClassIds(prev => [...prev, id]);
        }
    };

    const toggleAll = () => {
        if (selectedClassIds.length === filteredClasses.length) {
            setSelectedClassIds([]); // Deselect all
        } else {
            setSelectedClassIds(filteredClasses.map(c => c.id)); // Select all
        }
    };

    const handleSubmit = async () => {
        if (selectedClassIds.length === 0) {
            alert("Please select at least one class");
            return;
        }

        setLoading(true);
        try {
            // Process declarations in parallel for all selected classes
            const promises = selectedClassIds.map(classId => {
                const className = classes.find(c => c.id === classId)?.name || "Unknown Class";
                return declareNoClass({
                    classId,
                    date,
                    type,
                    note,
                    instructorId,
                    className
                });
            });

            const results = await Promise.all(promises);
            
            const failures = results.filter(r => r.error);
            if (failures.length > 0) {
                alert(`Failed to save for some classes. Example error: ${failures[0].error}`);
            } else {
                setSuccess(true);
                router.refresh();
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                }, 2000);
            }
        } finally {
            setLoading(false);
        }
    };

    const allSelected = filteredClasses.length > 0 && selectedClassIds.length === filteredClasses.length;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {success ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-500">
                            <CheckCircle2 className="h-12 w-12" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">Declarations Saved!</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Students have been notified successfully.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white">
                                    <CalendarOff className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Declare No Class</h3>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-full transition-colors">
                                <X className="h-5 w-5 text-amber-900 dark:text-amber-100" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* Date Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Effective Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-bold"
                                />
                            </div>

                            {/* Class Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1 mb-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select Classes</label>
                                    {filteredClasses.length > 0 && (
                                        <button 
                                            onClick={toggleAll}
                                            className="text-xs font-bold text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
                                        >
                                            {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                                            {allSelected ? "Deselect All" : "Select All"}
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                                    {filteredClasses.length > 0 ? (
                                        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
                                            {filteredClasses.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleClass(c.id)}
                                                    className={`flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                                        selectedClassIds.includes(c.id) ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                                                    }`}
                                                >
                                                    <div className={`flex items-center justify-center shrink-0 transition-colors ${
                                                        selectedClassIds.includes(c.id) ? "text-amber-500" : "text-gray-300 dark:text-gray-600"
                                                    }`}>
                                                        {selectedClassIds.includes(c.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                                    </div>
                                                    <span className={`font-bold text-sm truncate ${
                                                        selectedClassIds.includes(c.id) ? "text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"
                                                    }`}>
                                                        {c.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-6 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                                            No classes scheduled for this day
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Type selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Reason / Type</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {overrideTypes.map(t => (
                                        <button
                                            key={t.value}
                                            type="button"
                                            onClick={() => setType(t.value)}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${type === t.value
                                                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                                    : "border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                }`}
                                        >
                                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-lg ${type === t.value ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                                                }`}>
                                                {t.label.split(' ')[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-gray-900 dark:text-white">{t.label.split(' ')[1]}</div>
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400">{t.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Optional Note</label>
                                <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="e.g., 'National Holiday' or 'Moved to Zoom'"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div className="pt-2 flex gap-3 shrink-0">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-4 px-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || selectedClassIds.length === 0}
                                    className="flex-[2] py-4 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-200 dark:shadow-none"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarOff className="h-5 w-5" />}
                                    {loading ? "Processing..." : `Declare (${selectedClassIds.length})`}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 text-[10px] text-center text-gray-400 font-medium shrink-0">
                            This will exclude the date from attendance metrics for all selected classes.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
