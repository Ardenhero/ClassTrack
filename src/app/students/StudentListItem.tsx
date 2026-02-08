"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { updateStudent, deleteStudent } from "./actions";

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    fingerprint_id?: string | number;
}

export function StudentListItem({ student }: { student: Student }) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(student.name);
    const [yearLevel, setYearLevel] = useState(student.year_level);
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        await updateStudent(student.id, { name, year_level: yearLevel });
        setLoading(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (confirm("Are you sure? This will delete all attendance records for this student.")) {
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group relative">
            <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 bg-nwu-red/10 rounded-full flex items-center justify-center text-lg font-bold text-nwu-red">
                    {name[0]}
                </div>

                <div className="relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreHorizontal className="h-5 w-5" />
                    </button>

                    {/* Dropdown Menu */}
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
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                            >
                                <Trash2 className="h-3 w-3 mr-2" /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{name || "Unknown Student"}</h3>
            {student.sin && <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{student.sin}</p>}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{yearLevel || "Year Level N/A"}</p>

            <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                <div className="text-xs text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                    ID: {student.fingerprint_id ?? "N/A"}
                </div>
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                    Active
                </span>
            </div>
        </div>
    );
}
