"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { MoreHorizontal, Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { updateStudent, deleteStudent } from "./actions";
import { MultiDeleteBar } from "@/components/MultiDeleteBar";

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    fingerprint_slot_id?: number | null; // Added so UI can show enrollment status
}

interface StudentGridProps {
    students: Student[];
    isSuperAdmin: boolean;
}

export function StudentGrid({ students, isSuperAdmin }: StudentGridProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [localStudents, setLocalStudents] = useState<Student[]>(students);
    const router = useRouter();
    const supabase = createClient();

    // Sync local state when props change (server revalidation)
    useEffect(() => {
        setLocalStudents(students);
    }, [students]);

    useEffect(() => {
        console.log("Setting up realtime subscription for students table...");

        const channel = supabase
            .channel("realtime-students")
            .on(
                "postgres_changes",
                {
                    event: "*",          // INSERT, UPDATE, DELETE
                    schema: "public",
                    table: "students",
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (payload: any) => {
                    console.log("Realtime students change:", payload.eventType, payload);

                    if (payload.eventType === "UPDATE" && payload.new) {
                        // Optimistic local update for fingerprint_slot_id changes
                        // (enroll / unlink from ESP32) — avoids full round-trip flash
                        setLocalStudents((prev) =>
                            prev.map((s) =>
                                s.id === payload.new.id
                                    ? { ...s, ...payload.new }
                                    : s
                            )
                        );
                    } else {
                        // INSERT or DELETE — need server data, trigger full refresh
                        router.refresh();
                    }
                }
            )
            .subscribe((status) => {
                console.log("Realtime subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, router]);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        for (const id of Array.from(selected)) {
            await deleteStudent(id);
        }
        setSelected(new Set());
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localStudents.map((student) => (
                    <StudentCardItem
                        key={student.id}
                        student={student}
                        isSuperAdmin={isSuperAdmin}
                        isSelected={selected.has(student.id)}
                        onToggleSelect={() => toggleSelect(student.id)}
                    />
                ))}
            </div>

            {!isSuperAdmin && (
                <MultiDeleteBar
                    count={selected.size}
                    itemLabel={`student${selected.size !== 1 ? "s" : ""}`}
                    onDelete={handleBulkDelete}
                    onClear={() => setSelected(new Set())}
                />
            )}
        </>
    );
}

function StudentCardItem({
    student,
    isSuperAdmin,
    isSelected,
    onToggleSelect,
}: {
    student: Student;
    isSuperAdmin: boolean;
    isSelected: boolean;
    onToggleSelect: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(student.name || "");
    const [yearLevel, setYearLevel] = useState(student.year_level || "");
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // Keep local fields in sync when Realtime pushes an UPDATE
    useEffect(() => {
        setName(student.name || "");
        setYearLevel(student.year_level || "");
    }, [student.name, student.year_level]);

    const handleSave = async () => {
        setLoading(true);
        await updateStudent(student.id, { name, year_level: yearLevel });
        setLoading(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (
            confirm(
                "Are you sure? This will delete all attendance records for this student."
            )
        ) {
            await deleteStudent(student.id);
        }
    };

    const isEnrolled =
        student.fingerprint_slot_id !== null &&
        student.fingerprint_slot_id !== undefined;

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-nwu-red p-4 flex flex-col space-y-3">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border p-2 rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Name"
                />
                <input
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="border p-2 rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Year Level"
                />
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={() => setIsEditing(false)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="p-2 bg-nwu-red text-white hover:bg-red-700 rounded-lg"
                    >
                        <Check className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow group relative ${isSelected
                    ? "border-nwu-red ring-2 ring-nwu-red/30"
                    : "border-gray-100 dark:border-gray-700"
                }`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {!isSuperAdmin && (
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
                    {!isSuperAdmin && (
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                    )}

                    {showMenu && (
                        <div
                            className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-100 dark:border-gray-600 z-10 py-1"
                            onMouseLeave={() => setShowMenu(false)}
                        >
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setShowMenu(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                            >
                                <Pencil className="h-3 w-3 mr-2" /> Edit
                            </button>
                            <button
                                onClick={() => {
                                    handleDelete();
                                    setShowMenu(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                            >
                                <Trash2 className="h-3 w-3 mr-2" /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                {name || "Unknown Student"}
            </h3>
            {student.sin && (
                <p className="text-sm font-mono text-gray-500 dark:text-gray-400">
                    {student.sin}
                </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {yearLevel || "Year Level N/A"}
            </p>

            <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                    Active
                </span>

                {/* Real-time fingerprint enrollment badge */}
                {isEnrolled ? (
                    <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                        Slot #{student.fingerprint_slot_id}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-full">
                        Not enrolled
                    </span>
                )}
            </div>
        </div>
    );
}
