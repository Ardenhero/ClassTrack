"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { updateClass } from "./actions";
import { useRouter } from "next/navigation";

interface EditClassSlideOverProps {
    isOpen: boolean;
    onClose: () => void;
    classData: {
        id: string;
        name: string;
        description: string;
        start_time?: string;
        end_time?: string;
        year_level?: string;
        schedule_days?: string;
        room_id?: string | null;
    } | null;
}

export function EditClassSlideOver({ isOpen, onClose, classData }: EditClassSlideOverProps) {
    const [loading, setLoading] = useState(false);
    const [nameLength, setNameLength] = useState(0);
    const [descLength, setDescLength] = useState(0);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const router = useRouter();

    useEffect(() => {
        if (classData) {
            setNameLength(classData.name.length);
            setDescLength(classData.description?.length || 0);
            setSelectedDays(classData.schedule_days ? classData.schedule_days.split(",").map(d => d.trim()) : []);
        }
    }, [classData]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!classData) return;
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const result = await updateClass(classData.id, formData);

        if (result?.error) {
            alert(result.error);
        } else {
            onClose();
            router.refresh();
        }
        setLoading(false);
    };

    if (!isOpen || !classData) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="bg-white dark:bg-gray-800 shadow-2xl w-full max-w-xl max-h-[90vh] rounded-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in duration-300">
                <div className="flex-none p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Class Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                    <form id="edit-class-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Class Name</label>
                            <input
                                name="name"
                                required
                                maxLength={200}
                                defaultValue={classData.name}
                                onChange={(e) => setNameLength(e.target.value.length)}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-900 dark:text-white transition-all"
                            />
                            <p className="text-[10px] text-gray-400 text-right font-medium uppercase tracking-wider">{nameLength} / 200 Characters</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                   Start Time
                                </label>
                                <input
                                    name="start_time"
                                    type="time"
                                    required
                                    defaultValue={classData.start_time ? classData.start_time.substring(0, 5) : ""}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-900 dark:text-white transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    End Time
                                </label>
                                <input
                                    name="end_time"
                                    type="time"
                                    required
                                    defaultValue={classData.end_time ? classData.end_time.substring(0, 5) : ""}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-900 dark:text-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Year Level
                            </label>
                            <select
                                name="year_level"
                                required
                                defaultValue={classData.year_level}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-900 dark:text-white transition-all"
                            >
                                <option value="1st Year">1st Year</option>
                                <option value="2nd Year">2nd Year</option>
                                <option value="3rd Year">3rd Year</option>
                                <option value="4th Year">4th Year</option>
                            </select>
                        </div>


                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Schedule Days <span className="text-red-500">*</span>
                            </label>
                            <input type="hidden" name="schedule_days" value={selectedDays.join(",")} />
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                                    const isActive = selectedDays.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => setSelectedDays(prev =>
                                                prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                            )}
                                            className={`py-2 text-xs font-bold rounded-xl border transition-all ${isActive
                                                ? "bg-nwu-red text-white border-nwu-red ring-4 ring-red-500/10"
                                                : "bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedDays.length === 0 && (
                                <p className="text-xs text-red-500 flex items-center mt-1 font-medium">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Select at least one day
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
                            <textarea
                                name="description"
                                maxLength={500}
                                defaultValue={classData.description}
                                onChange={(e) => setDescLength(e.target.value.length)}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-nwu-red dark:bg-gray-900 dark:text-white transition-all"
                                placeholder="Optional notes about the class"
                                rows={4}
                            />
                            <p className="text-[10px] text-gray-400 text-right font-medium uppercase tracking-wider">{descLength} / 500 Characters</p>
                        </div>
                    </form>
                </div>

                <div className="flex-none p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 font-bold text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-xl transition-all"
                        >
                            Discard
                        </button>
                        <button
                            form="edit-class-form"
                            type="submit"
                            disabled={loading || selectedDays.length === 0}
                            className="px-8 py-2.5 font-bold text-sm bg-nwu-red text-white rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : "Update Class"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
