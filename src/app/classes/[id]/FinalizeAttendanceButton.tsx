"use client";

import { useState } from "react";
import { ClipboardCheck, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface FinalizeAttendanceButtonProps {
    classId: string;
    date: string;
    enrolledStudentIds: string[];
    presentStudentIds: string[];
    isHoliday: boolean;
}

export default function FinalizeAttendanceButton({
    classId,
    date,
    enrolledStudentIds,
    presentStudentIds,
    isHoliday,
}: FinalizeAttendanceButtonProps) {
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const absentStudents = enrolledStudentIds.filter(id => !presentStudentIds.includes(id));
    const absentCount = absentStudents.length;

    if (isHoliday || absentCount === 0 || presentStudentIds.length === 0) {
        // Don't show if: day is marked as no-class, everyone is present, or nobody scanned
        return null;
    }

    const handleFinalize = async () => {
        if (!confirm(
            `Finalize attendance for this date?\n\n` +
            `${presentStudentIds.length} student(s) already scanned in.\n` +
            `${absentCount} student(s) will be marked "Absent".\n\n` +
            `This action creates official absence records.`
        )) return;

        setLoading(true);
        try {
            // Create Absent records for students who didn't scan
            const records = absentStudents.map(studentId => ({
                student_id: parseInt(studentId),
                class_id: classId,
                status: "Absent",
                timestamp: `${date}T00:00:00+08:00`,
            }));

            const { error } = await supabase
                .from("attendance_logs")
                .insert(records);

            if (error) {
                alert("Failed to finalize: " + error.message);
            } else {
                setDone(true);
                router.refresh();
            }
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-100 rounded-lg flex items-center gap-1.5 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Finalized ✓
            </div>
        );
    }

    return (
        <button
            onClick={handleFinalize}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-all flex items-center gap-1.5 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/40"
            title={`Mark ${absentCount} students as Absent`}
        >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Finalize ({absentCount} absent)
        </button>
    );
}
