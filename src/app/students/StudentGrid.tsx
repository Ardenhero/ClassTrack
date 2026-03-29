"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Archive, Check, X as XIcon, Loader2, User } from "lucide-react";
import { updateStudent, archiveStudent, bulkArchiveStudents } from "./actions";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useProfile } from "@/context/ProfileContext";
import { MultiDeleteBar } from "@/components/MultiDeleteBar";
import { DeptBadge } from "@/components/DepartmentGroup";
import type { Department } from "@/lib/departments";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    department?: string;
    image_url?: string | null;
}

interface StudentGridProps {
    students: Student[];
    isSuperAdmin: boolean;
    isAdmin?: boolean;
    departments?: Department[];
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
    onSelectAll: () => void;
}

export default function StudentGrid({ students, isSuperAdmin, isAdmin, departments = [], selectedIds, onToggleSelect, onSelectAll }: StudentGridProps) {
    const router = useRouter();
    const { profile } = useProfile();
    const canEdit = !isSuperAdmin && !isAdmin;
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

    const handleBulkArchive = async () => {
        if (!selectedIds.length) return;
        setConfirmConfig({
            isOpen: true,
            title: "Bulk Archive Students",
            message: `Archive ${selectedIds.length} selected student${selectedIds.length !== 1 ? "s" : ""}? They will be moved to the archive and can be restored later.`,
            variant: "warning",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                const res = await bulkArchiveStudents(selectedIds, profile?.id);
                if (res.error) {
                    alert(res.error);
                } else {
                    router.refresh();
                }
            }
        });
    };

    return (
        <>
            {canEdit && students.length > 0 && (
                <div className="flex justify-end mb-4">
                    <button
                        onClick={onSelectAll}
                        className="flex items-center px-4 py-2 text-sm font-semibold text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        {selectedIds.length === students.length ? <Check className="w-4 h-4 mr-2 text-nwu-red" /> : <XIcon className="w-4 h-4 mr-2" />}
                        {selectedIds.length === students.length ? "Deselect All" : "Select All"}
                    </button>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {students.map((student) => (
                    <StudentCardItem
                        key={student.id}
                        student={student}
                        canEdit={canEdit}
                        isSelected={selectedIds.includes(student.id)}
                        onToggleSelect={() => onToggleSelect(student.id)}
                        departments={departments}
                        setConfirmConfig={setConfirmConfig}
                    />
                ))}
            </div>

            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />

            {canEdit && (
                <MultiDeleteBar
                    count={selectedIds.length}
                    itemLabel={`student${selectedIds.length !== 1 ? "s" : ""}`}
                    onDelete={handleBulkArchive}
                    onClear={() => onSelectAll()}
                    actionLabel="Archive"
                />
            )}
        </>
    );
}

function StudentCardItem({ student, canEdit, isSelected, onToggleSelect, departments, setConfirmConfig }: {
    student: Student;
    canEdit: boolean;
    isSelected: boolean;
    onToggleSelect: () => void;
    departments: Department[];
    setConfirmConfig: React.Dispatch<React.SetStateAction<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: "danger" | "warning";
    }>>;
}) {
    const router = useRouter();
    const { profile } = useProfile();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(student.name || "");
    const [yearLevel, setYearLevel] = useState(student.year_level || "");
    const [department, setDepartment] = useState(student.department || "");
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        await updateStudent(student.id, { name, year_level: yearLevel, department });
        setLoading(false);
        setIsEditing(false);
        router.refresh();
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
                <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="border p-2 rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="" disabled>Select Dept</option>
                    <option value="Unknown">Unknown</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.code}>{d.code}</option>
                    ))}
                </select>
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
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-all group relative transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] ${isSelected ? "border-nwu-red ring-2 ring-nwu-red/20" : "border-gray-100 dark:border-gray-700"}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {canEdit && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggleSelect}
                            className="h-4 w-4 rounded border-gray-300 text-nwu-red focus:ring-nwu-red cursor-pointer"
                        />
                    )}
                    <div className="h-12 w-12 bg-nwu-red/10 rounded-full flex items-center justify-center text-lg font-bold text-nwu-red overflow-hidden relative border border-gray-100 dark:border-gray-700">
                        {student.image_url ? (
                            <Image
                                src={student.image_url}
                                alt={name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            (name || "U")[0]?.toUpperCase() || <User className="h-5 w-5" />
                        )}
                    </div>
                </div>

                {canEdit && (
                    <div className="absolute top-2 right-2 scale-90">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                        >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20 overflow-hidden text-xs">
                                <button
                                    onClick={() => { setShowMenu(false); setIsEditing(true); }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-gray-700 dark:text-gray-300"
                                >
                                    <Pencil className="h-3 w-3 mr-2" /> Edit Info
                                </button>
                                <button
                                    onClick={() => { handleDelete(); }}
                                    disabled={loading}
                                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center text-nwu-red disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                    ) : (
                                        <Archive className="h-3 w-3 mr-2" />
                                    )}
                                    {loading ? "..." : "Archive"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Link href={`/students/${student.id}`} className="inline-block active:scale-95 transition-transform truncate w-full">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 hover:text-nwu-red transition-colors cursor-pointer truncate" title={name}>{name || "Unknown"}</h3>
            </Link>
            {student.sin && <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-2">{student.sin}</p>}
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{yearLevel || "Year Level N/A"}</p>
                <div className="scale-90 origin-left"><DeptBadge department={student.department || ""} /></div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-50 dark:border-gray-700/50 flex justify-end items-center">
                <span className="text-xs text-green-600 font-bold px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded-full">
                    Active
                </span>
            </div>
        </div >
    );
}
