"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Archive, Check, X as XIcon, Fingerprint, RefreshCcw, Loader2 } from "lucide-react";
import { updateStudent, archiveStudent, clearBiometricData } from "./actions";
import { useRouter } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    fingerprint_slot_id?: number | null;
}

export default function StudentListItem({ student }: { student: Student }) {
    const router = useRouter();
    const { profile } = useProfile();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(student.name || "");
    const [yearLevel, setYearLevel] = useState(student.year_level || "");
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        variant: "warning"
    });

    const handleSave = async () => {
        setLoading(true);
        await updateStudent(student.id, { name, year_level: yearLevel });
        setLoading(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        setConfirmConfig({
            isOpen: true,
            title: "Archive Student",
            message: "Archive this student? They will be moved to the archive and can be restored later.",
            variant: "warning",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                setLoading(true);
                const res = await archiveStudent(student.id, profile?.id);
                if (res?.error) {
                    alert(res.error);
                    setLoading(false);
                } else {
                    setShowMenu(false);
                    router.refresh();
                }
            }
        });
    };

    const handleClearBiometric = async () => {
        setConfirmConfig({
            isOpen: true,
            title: "Reset Biometrics",
            message: `Are you sure you want to unlink biometric data for ${name}?`,
            variant: "danger",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                await clearBiometricData(student.id);
                setShowMenu(false);
            }
        });
    };

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-nwu-red p-4 flex flex-col space-y-3 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="border p-2 rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Name"
                />
                <input
                    value={yearLevel}
                    onChange={e => setYearLevel(e.target.value)}
                    className="border p-2 rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Year Level"
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsEditing(false)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <XIcon className="h-4 w-4" />
                    </button>
                    <button onClick={handleSave} disabled={loading} className="p-2 bg-nwu-red text-white hover:bg-red-700 rounded-lg">
                        <Check className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 group relative transform transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgb(255,255,255,0.05)]">
            <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 bg-nwu-red/10 rounded-full flex items-center justify-center text-lg font-bold text-nwu-red">
                    {(name || "U")[0]?.toUpperCase() || "?"}
                </div>

                <div className="relative">
                    {/* The original code had `!isSuperAdmin` here, but `isSuperAdmin` is not a prop for StudentListItem.
                        Assuming this check was meant for a different component or needs to be removed/handled differently.
                        For now, removing the check to avoid a reference error. */}
                    {/* {!isSuperAdmin && ( */}
                    <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreHorizontal className="h-5 w-5" />
                    </button>
                    {/* )} */}

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-100 dark:border-gray-600 z-10 py-1" onMouseLeave={() => setShowMenu(false)}>
                            <button
                                onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                            >
                                <Pencil className="h-3 w-3 mr-2" /> Edit Details
                            </button>
                            {student.fingerprint_slot_id !== null && student.fingerprint_slot_id !== undefined && (
                                <button
                                    onClick={handleClearBiometric}
                                    className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center"
                                >
                                    <RefreshCcw className="h-3 w-3 mr-2" /> Reset Biometrics
                                </button>
                            )}
                            <button
                                onClick={() => { handleDelete(); }}
                                disabled={loading}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center text-nwu-red disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                ) : (
                                    <Archive className="h-3 w-3 mr-2" />
                                )}
                                {loading ? "Archiving..." : "Archive"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Link href={`/students/${student.id}`} className="inline-block active:scale-95 transition-transform">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 hover:text-nwu-red transition-colors cursor-pointer">{name || "Unknown Student"}</h3>
            </Link>
            {student.sin && <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{student.sin}</p>}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{yearLevel || "Year Level N/A"}</p>

            <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                {/* Biometric Status Badge */}
                {student.fingerprint_slot_id ? (
                    <div className="flex items-center text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-full">
                        <Fingerprint className="h-3 w-3 mr-1" />
                        Slot #{student.fingerprint_slot_id}
                    </div>
                ) : (
                    <div className="flex items-center text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                        <Fingerprint className="h-3 w-3 mr-1" />
                        Not Enrolled
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />
        </div>
    );
}
