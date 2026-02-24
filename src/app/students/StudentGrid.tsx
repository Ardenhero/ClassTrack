"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Archive, Check, X as XIcon } from "lucide-react";
import { updateStudent, deleteStudent } from "./actions";
import { MultiDeleteBar } from "@/components/MultiDeleteBar";

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
}

interface StudentGridProps {
    students: Student[];
    isSuperAdmin: boolean;
    isAdmin?: boolean;
}

export function StudentGrid({ students, isSuperAdmin, isAdmin }: StudentGridProps) {
    const canEdit = !isSuperAdmin && !isAdmin; // Only instructors can edit/archive
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Archive ${selected.size} student${selected.size !== 1 ? "s" : ""}? They can be restored from the Archived page.`)) return;
        for (const id of Array.from(selected)) {
            await deleteStudent(id);
        }
        setSelected(new Set());
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {students.map((student) => (
                    <StudentCardItem
                        key={student.id}
                        student={student}
                        canEdit={canEdit}
                        isSelected={selected.has(student.id)}
                        onToggleSelect={() => toggleSelect(student.id)}
                    />
                ))}
            </div>

            {canEdit && (
                <MultiDeleteBar
                    count={selected.size}
                    itemLabel={`student${selected.size !== 1 ? "s" : ""}`}
                    onDelete={handleBulkDelete}
                    onClear={() => setSelected(new Set())}
                    actionLabel="Archive"
                />
            )}
        </>
    );
}

function StudentCardItem({ student, canEdit, isSelected, onToggleSelect }: {
    student: Student;
    canEdit: boolean;
    isSelected: boolean;
    onToggleSelect: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(student.name || "");
    const [yearLevel, setYearLevel] = useState(student.year_level || "");
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        await updateStudent(student.id, { name, year_level: yearLevel });
        setLoading(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (confirm("Archive this student? They can be restored later from the Archived page.")) {
            await deleteStudent(student.id);
        }
    };

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-nwu-red p-4 flex flex-col space-y-3">
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
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow group relative ${isSelected ? "border-nwu-red ring-2 ring-nwu-red/30" : "border-gray-100 dark:border-gray-700"}`}>
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
                    <div className="h-12 w-12 bg-nwu-red/10 rounded-full flex items-center justify-center text-lg font-bold text-nwu-red">
                        {(name || "U")[0]?.toUpperCase() || "?"}
                    </div>
                </div>

                <div className="relative">
                    {canEdit && (
                        <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                    )}

                    {showMenu && (
                        <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-100 dark:border-gray-600 z-10 py-1" onMouseLeave={() => setShowMenu(false)}>
                            <button
                                onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                            >
                                <Pencil className="h-3 w-3 mr-2" /> Edit
                            </button>
                            <button
                                onClick={() => { handleDelete(); setShowMenu(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center"
                            >
                                <Archive className="h-3 w-3 mr-2" /> Archive
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{name || "Unknown Student"}</h3>
            {student.sin && <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{student.sin}</p>}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{yearLevel || "Year Level N/A"}</p>

            <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-end items-center">
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                    Active
                </span>
            </div>
        </div>
    );
}
