"use client";

import { useState } from "react";
import { GraduationCap, ArrowUpCircle, X, UserMinus, Trash2, Loader2 } from "lucide-react";
import { promoteStudentsBatch, bulkUnenrollStudentsFromDepartment } from "./actions";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface BatchActionBarProps {
    selectedIds: string[];
    onClear: () => void;
    onSuccess: () => void;
}

export function BatchActionBar({ selectedIds, onClear, onSuccess }: BatchActionBarProps) {
    const [isPending, setIsPending] = useState(false);
    const [showPromoteOptions, setShowPromoteOptions] = useState(false);
    const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
    const count = selectedIds.length;

    if (count === 0) return null;

    async function handlePromote(level: string) {
        setIsPending(true);
        const res = await promoteStudentsBatch(selectedIds, level, 'active');
        if (res.error) alert(res.error);
        else {
            onSuccess();
            onClear();
        }
        setIsPending(false);
        setShowPromoteOptions(false);
    }

    async function handleGraduate() {
        if (!confirm(`Are you sure you want to graduate ${count} student(s)? This will change their status to 'graduated'.`)) return;
        setIsPending(true);
        const res = await promoteStudentsBatch(selectedIds, '4th Year', 'graduated');
        if (res.error) alert(res.error);
        else {
            onSuccess();
            onClear();
        }
        setIsPending(false);
    }

    async function handleDrop() {
        if (!confirm(`Are you sure you want to mark ${count} student(s) as Dropped / Transferred?`)) return;
        setIsPending(true);
        // Keep their current year level but change status
        const res = await promoteStudentsBatch(selectedIds, 'current', 'dropped');
        if (res.error) alert(res.error);
        else {
            onSuccess();
            onClear();
        }
        setIsPending(false);
    }

    async function handleBulkUnenroll() {
        setShowUnenrollConfirm(false);
        setIsPending(true);
        const res = await bulkUnenrollStudentsFromDepartment(selectedIds);
        if (res.error) alert(res.error);
        else {
            onSuccess();
            onClear();
        }
        setIsPending(false);
    }

    return (
        <>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl p-2 flex items-center gap-2 pr-4 ring-1 ring-white/10">
                    <div className="bg-nwu-red text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                        <span className="bg-white/20 px-1.5 py-0.5 rounded-md">{count}</span>
                        Selected
                    </div>

                    <div className="h-4 w-px bg-gray-800 mx-1" />

                    {showPromoteOptions ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                            {["1st", "2nd", "3rd", "4th"].map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => handlePromote(`${lvl} Year`)}
                                    disabled={isPending}
                                    className="px-3 py-1.5 bg-gray-900 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-white/5"
                                >
                                    {lvl}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowPromoteOptions(false)}
                                className="p-1.5 text-gray-500 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowPromoteOptions(true)}
                                disabled={isPending}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-white/5"
                            >
                                <ArrowUpCircle className="h-3.5 w-3.5 text-blue-400" />
                                Promote
                            </button>

                            <button
                                onClick={handleGraduate}
                                disabled={isPending}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-white/5"
                            >
                                <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
                                Graduate
                            </button>

                            <button
                                onClick={handleDrop}
                                disabled={isPending}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-white/5"
                            >
                                <UserMinus className="h-3.5 w-3.5 text-orange-400" />
                                Drop
                            </button>

                            <button
                                onClick={() => setShowUnenrollConfirm(true)}
                                disabled={isPending}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-red-500/20"
                            >
                                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Unenroll
                            </button>
                        </div>
                    )}

                    <div className="h-4 w-px bg-gray-800 mx-1" />

                    <button
                        onClick={onClear}
                        disabled={isPending}
                        className="p-2 text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <ConfirmationModal 
                isOpen={showUnenrollConfirm}
                onClose={() => setShowUnenrollConfirm(false)}
                onConfirm={handleBulkUnenroll}
                title="EXTREME CAUTION: Bulk Unenrollment"
                message={`You are about to PERMANENTLY DELETE ${count} student(s) from the department. This will wipe their attendance records, fingerprint slots, and all history. This cannot be undone.`}
                confirmLabel={`Yes, Delete ${count} Students`}
                variant="danger"
                isLoading={isPending}
            />
        </>
    );
}
