"use client";

import { useState } from "react";
import { endCurrentSemester, startNewSemester } from "./actions";
import { Loader2, CalendarClock, AlertTriangle, Play, Square, Calendar } from "lucide-react";

export function SemesterManager({ activeSemester }: { activeSemester: { id: string, name: string, start_date: string, end_date: string } | null }) {
    const [loading, setLoading] = useState(false);
    const [isStartingNew, setIsStartingNew] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // New semester form
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const handleEndSemester = async () => {
        if (!activeSemester?.id) return;
        setLoading(true);
        setErrorMsg("");
        try {
            const res = await endCurrentSemester(activeSemester.id);
            if (res.error) throw new Error(res.error);
            setConfirmEnd(false);
        } catch (err) {
            if (err instanceof Error) setErrorMsg(err.message);
            else setErrorMsg(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleStartSemester = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");
        try {
            const res = await startNewSemester({ name, start_date: startDate, end_date: endDate });
            if (res.error) throw new Error(res.error);
            setIsStartingNew(false);
            setName("");
            setStartDate("");
            setEndDate("");
        } catch (err) {
            if (err instanceof Error) setErrorMsg(err.message);
            else setErrorMsg(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Semester Management</h2>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Manage the academic year cycle. Ending a semester will automatically archive all active students and classes across the entire system.
            </p>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {errorMsg}
                </div>
            )}

            {!activeSemester ? (
                <div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between mb-4">
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">No Active Semester</p>
                            <p className="text-sm text-gray-500">The system is currently in an idle state.</p>
                        </div>
                    </div>

                    {!isStartingNew ? (
                        <button
                            onClick={() => setIsStartingNew(true)}
                            className="bg-nwu-red hover:bg-[#5e0d0e] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                        >
                            <Play className="w-4 h-4" /> Start New Semester
                        </button>
                    ) : (
                        <form onSubmit={handleStartSemester} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white">New Semester Details</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester Name</label>
                                <input type="text" required placeholder="e.g. 1st Semester 2026-2027" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-nwu-red" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-nwu-red" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-nwu-red" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-4">
                                <button type="button" onClick={() => setIsStartingNew(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-nwu-red text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />} Start Semester
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center shrink-0">
                                <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-green-900 dark:text-green-100">{activeSemester.name}</p>
                                <p className="text-sm text-green-700/80 dark:text-green-400/80 mt-0.5">
                                    {new Date(activeSemester.start_date).toLocaleDateString()} to {new Date(activeSemester.end_date).toLocaleDateString()}
                                </p>
                                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                                    Active Now
                                </span>
                            </div>
                        </div>

                        {!confirmEnd ? (
                            <button
                                onClick={() => setConfirmEnd(true)}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                            >
                                <Square className="w-4 h-4" /> End Semester
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 flex-col items-end">
                                <p className="text-xs font-bold text-red-600">Archive all classes & students?</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setConfirmEnd(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancel</button>
                                    <button onClick={handleEndSemester} disabled={loading} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1">
                                        {loading && <Loader2 className="w-3 h-3 animate-spin" />} Confirm End
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
