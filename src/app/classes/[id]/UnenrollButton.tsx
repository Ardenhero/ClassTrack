"use client";

import { useState } from "react";
import { UserMinus, Loader2 } from "lucide-react";
import { removeStudent } from "./actions";

interface UnenrollButtonProps {
    classId: string;
    studentId: string;
    studentName: string;
    className_: string;
}

export function UnenrollButton({ classId, studentId, studentName, className_ }: UnenrollButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleUnenroll = async () => {
        if (!confirm(`Remove "${studentName}" from ${className_}?\n\nTheir attendance history for this class will be preserved, but they will no longer appear on the roster. You can re-enroll them later.`)) return;
        setLoading(true);
        await removeStudent(classId, studentId);
        setLoading(false);
    };

    return (
        <button
            onClick={handleUnenroll}
            disabled={loading}
            className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Unenroll Student"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
        </button>
    );
}
