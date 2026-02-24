"use client";

import { useState } from "react";
import { AlertTriangle, Calendar, CheckCircle2, CloudRain, ShieldAlert, X, Loader2, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { createClient } from "@/utils/supabase/client";
import { useEffect } from "react";

export default function DeclareSuspensionsButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<"manual" | "auto">("manual");
    const [date, setDate] = useState("");
    const [type, setType] = useState<"weather" | "university" | "holiday">("weather");
    const [customNote, setCustomNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [syncedHolidays, setSyncedHolidays] = useState<{ date: string, note: string }[]>([]);

    useEffect(() => {
        if (isOpen && mode === "auto") {
            const fetchHolidays = async () => {
                const supabase = createClient();
                const today = new Date().toISOString().split("T")[0];
                const { data } = await supabase
                    .from("class_day_overrides")
                    .select("date, note")
                    .eq("type", "holiday")
                    .gte("date", today)
                    .order("date", { ascending: true });

                if (data) {
                    const unique = [];
                    const seen = new Set();
                    for (const row of data) {
                        if (!seen.has(row.date)) {
                            seen.add(row.date);
                            unique.push(row);
                        }
                    }
                    setSyncedHolidays(unique);
                }
            };
            fetchHolidays();
        }
    }, [isOpen, mode]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const res = await fetch("/api/attendance/declare-suspensions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "manual",
                    date,
                    type,
                    note: customNote,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to declare suspension");

            setSuccessMsg(`Suspension declared! Applied to ${data.classesAffected} classes.`);
            setTimeout(() => setIsOpen(false), 3000);
        } catch (err) {
            if (err instanceof Error) setErrorMsg(err.message);
            else setErrorMsg(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSync = async () => {
        setLoading(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const res = await fetch("/api/attendance/declare-suspensions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "auto" }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to sync holidays");

            setSuccessMsg(`Synced ${data.holidaysCount} holidays! Applied to ${data.classesAffected} classes.`);
            setTimeout(() => setIsOpen(false), 3000);
        } catch (err) {
            if (err instanceof Error) setErrorMsg(err.message);
            else setErrorMsg(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 bg-nwu-red hover:bg-[#5e0d0e] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
                <AlertTriangle className="w-5 h-5" />
                Declare Suspension
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-nwu-red" />
                                Declare Suspension
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex border-b border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => { setMode("manual"); setSuccessMsg(""); setErrorMsg(""); }}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium transition-colors",
                                    mode === "manual" ? "text-nwu-red border-b-2 border-nwu-red bg-red-50 dark:bg-red-900/10" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                )}
                            >
                                Manual Declaration
                            </button>
                            <button
                                onClick={() => { setMode("auto"); setSuccessMsg(""); setErrorMsg(""); }}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium transition-colors",
                                    mode === "auto" ? "text-nwu-red border-b-2 border-nwu-red bg-red-50 dark:bg-red-900/10" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                )}
                            >
                                Auto-Sync PH Holidays
                            </button>
                        </div>

                        <div className="p-4">
                            {errorMsg && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            {successMsg && (
                                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{successMsg}</span>
                                </div>
                            )}

                            {mode === "manual" ? (
                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                required
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-nwu-red"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suspension Type</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            <label className={cn(
                                                "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all",
                                                type === "weather" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                            )}>
                                                <input type="radio" name="type" className="hidden" checked={type === "weather"} onChange={() => setType("weather")} />
                                                <CloudRain className={cn("w-5 h-5", type === "weather" ? "text-blue-500" : "text-gray-400")} />
                                                <div>
                                                    <div className={cn("font-medium text-sm", type === "weather" ? "text-blue-900 dark:text-blue-100" : "text-gray-700 dark:text-gray-300")}>Weather Inclement</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Typhoon, Heavy Rain, Flooding</div>
                                                </div>
                                            </label>

                                            <label className={cn(
                                                "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all",
                                                type === "university" ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                            )}>
                                                <input type="radio" name="type" className="hidden" checked={type === "university"} onChange={() => setType("university")} />
                                                <ShieldAlert className={cn("w-5 h-5", type === "university" ? "text-amber-500" : "text-gray-400")} />
                                                <div>
                                                    <div className={cn("font-medium text-sm", type === "university" ? "text-amber-900 dark:text-amber-100" : "text-gray-700 dark:text-gray-300")}>University Suspension</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Presidential declaration, Emergency</div>
                                                </div>
                                            </label>

                                            <label className={cn(
                                                "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all",
                                                type === "holiday" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                            )}>
                                                <input type="radio" name="type" className="hidden" checked={type === "holiday"} onChange={() => setType("holiday")} />
                                                <Calendar className={cn("w-5 h-5", type === "holiday" ? "text-emerald-500" : "text-gray-400")} />
                                                <div>
                                                    <div className={cn("font-medium text-sm", type === "holiday" ? "text-emerald-900 dark:text-emerald-100" : "text-gray-700 dark:text-gray-300")}>Holiday</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Local or custom holiday</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Optional Note</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Typhoon Leon Suspension"
                                            value={customNote}
                                            onChange={(e) => setCustomNote(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-nwu-red"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !date}
                                        className="w-full mt-4 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm font-medium text-white bg-nwu-red hover:bg-[#5e0d0e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nwu-red transition-colors disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Declare Suspension"}
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-4 text-center py-4">
                                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Calendar className="w-8 h-8 text-blue-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Philippine National Holidays</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        Automatically fetch and apply all official non-working Philippine holidays for the current year to all active classes.
                                    </p>

                                    <button
                                        onClick={handleAutoSync}
                                        disabled={loading}
                                        className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 mt-4"
                                    >
                                        {loading ? (
                                            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Syncing with PH Calendar...</>
                                        ) : (
                                            "Sync Active Year Holidays"
                                        )}
                                    </button>

                                    {syncedHolidays.length > 0 && (
                                        <div className="mt-6 text-left border-t pt-4 dark:border-gray-700">
                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                                                <Info className="w-4 h-4 text-gray-400" />
                                                Upcoming Synced Holidays
                                            </h4>
                                            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                                {syncedHolidays.map((h, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs">
                                                        <span className="font-mono text-gray-500 dark:text-gray-400">{h.date}</span>
                                                        <span className="text-gray-700 dark:text-gray-300 ml-2 truncate">{h.note || "Holiday"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
