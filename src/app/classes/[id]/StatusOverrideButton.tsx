"use client";

import { useState } from "react";
import { CheckCircle, Clock, AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface StatusOverrideButtonProps {
    studentId: string;
    classId: string;
    date: string;
    currentStatus: string;
}

const statusOptions = [
    { label: "Present", value: "Present", icon: CheckCircle, color: "text-green-600" },
    { label: "Late", value: "Late", icon: Clock, color: "text-orange-600" },
    { label: "Excused", value: "Excused", icon: CheckCircle, color: "text-blue-600" },
    { label: "Absent", value: "Absent", icon: AlertCircle, color: "text-red-600" },
];

export default function StatusOverrideButton({ studentId, classId, date, currentStatus }: StatusOverrideButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleOverride = async (newStatus: string) => {
        if (newStatus === currentStatus) {
            setOpen(false);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/attendance/override", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: studentId,
                    class_id: classId,
                    date,
                    new_status: newStatus,
                }),
            });
            if (res.ok) {
                router.refresh(); // Refresh server component data
            } else {
                const data = await res.json();
                alert(data.error || "Failed to override status");
            }
        } catch {
            alert("Network error");
        } finally {
            setLoading(false);
            setOpen(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-nwu-red hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                title="Override attendance status"
            >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                <span className="hidden sm:inline">Override</span>
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] animate-in slide-in-from-top-2 duration-100">
                        <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Set Status</div>
                        {statusOptions.map((opt) => {
                            const Icon = opt.icon;
                            const isActive = opt.value === currentStatus;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => handleOverride(opt.value)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isActive ? "font-bold bg-gray-50 dark:bg-gray-700" : ""}`}
                                >
                                    <Icon className={`h-3.5 w-3.5 ${opt.color}`} />
                                    <span className={isActive ? opt.color : "text-gray-700 dark:text-gray-300"}>{opt.label}</span>
                                    {isActive && <span className="ml-auto text-[10px] text-gray-400">current</span>}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
