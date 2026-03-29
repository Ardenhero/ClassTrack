"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, ChevronRight, ShieldAlert, BookOpen } from "lucide-react";

interface AbsenceAlert {
    className: string;
    instructorName: string;
    absentCount: number;
}

interface AbsenceWarningModalProps {
    alerts: AbsenceAlert[];
    onClose: () => void;
}

export function AbsenceWarningModal({ alerts, onClose }: AbsenceWarningModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);

    if (alerts.length === 0) return null;

    const current = alerts[currentIndex];

    const handleNext = () => {
        if (currentIndex < alerts.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setAcknowledged(false);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/50 backdrop-blur-sm transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800 transition-all duration-500 transform ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
                {/* Warning Header */}
                <div className="relative h-24 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-4 left-4 h-12 w-12 rounded-full bg-white blur-xl animate-pulse" />
                        <div className="absolute bottom-4 right-4 h-16 w-16 rounded-full bg-white blur-2xl animate-pulse delay-500" />
                    </div>
                    <div className="relative z-10 h-10 w-10 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 -rotate-3 shadow-2xl">
                        <ShieldAlert className="h-6 w-6 text-white" />
                    </div>
                    <div className="absolute top-2 left-3 text-white/70 text-[8px] font-black uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="h-2 w-2" />
                        Warning {currentIndex + 1} of {alerts.length}
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-amber-600 font-black text-[8px] uppercase tracking-[0.2em]">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Attendance Alert
                        </div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                            {current.className === "Overall Attendance Record" ? "Action Required" : "Risk of being dropped"}
                        </h2>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/30 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <BookOpen className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{current.className}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-amber-100 dark:border-amber-900/20">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Absences</span>
                            <span className="text-2xl font-black text-red-600">{current.absentCount}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed italic">
                            {current.className === "Overall Attendance Record" 
                                ? "Your total absences across all classes have reached a critical level. Please visit the OSA."
                                : "Contact your instructor immediately to discuss your record."}
                        </p>
                    </div>


                    {/* Forced Acknowledgment Checkbox */}
                    <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(e) => setAcknowledged(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-2 border-gray-300 dark:border-gray-600 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 leading-normal">
                            I acknowledge my <span className="font-bold text-gray-900 dark:text-white">{current.absentCount} absences</span> in <span className="font-bold text-gray-900 dark:text-white">{current.className}</span>.
                        </span>
                    </label>

                    <div className="flex flex-col pt-1">
                        <button
                            onClick={handleNext}
                            disabled={!acknowledged}
                            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                acknowledged
                                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg cursor-pointer active:scale-95"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            {currentIndex < alerts.length - 1 ? (
                                <>
                                    Next Warning <ChevronRight className="h-3 w-3" />
                                </>
                            ) : (
                                <>
                                    I Understand <ArrowRight className="h-3 w-3" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
