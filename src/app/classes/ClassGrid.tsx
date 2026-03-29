"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Users, Calendar, Clock } from "lucide-react";
import { ClassCardActions } from "./ClassCardActions";
import { MultiDeleteBar } from "../../components/MultiDeleteBar";
import { deleteClass } from "./actions";
import { format, parse } from "date-fns";
import { EditClassSlideOver } from "./EditClassSlideOver";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface ClassItem {
    id: string;
    name: string;
    description: string;
    year_level?: string;
    department?: string;
    schedule_days?: string;
    start_time?: string;
    end_time?: string;
    instructor_id: string;
    enrollments: { count: number }[];
}

interface ClassGridProps {
    classes: ClassItem[];
    isSuperAdmin: boolean;
    isAdmin?: boolean;
    isReadOnly?: boolean;
    profileId?: string;
}

export function ClassGrid({ classes, isSuperAdmin, isAdmin, isReadOnly = false, profileId }: ClassGridProps) {
    const canEditGeneral = !isSuperAdmin && !isAdmin && !isReadOnly; // Standard instructor check

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [editClass, setEditClass] = useState<ClassItem | null>(null);
    const [archiveClass, setArchiveClass] = useState<ClassItem | null>(null);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        for (const id of Array.from(selected)) {
            await deleteClass(id);
        }
        setSelected(new Set());
    };

    const canAnyEdit = classes.some(c => {
        const isOwner = profileId && c.instructor_id === profileId;
        return !isReadOnly && (canEditGeneral || (isAdmin && isOwner && !isSuperAdmin));
    });

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((c) => {
                    // Dept Admin ownership check: They CAN edit if they are the instructor, even if isAdmin is true.
                    const isOwner = profileId && c.instructor_id === profileId;
                    const canEditThisClass = !isReadOnly && (canEditGeneral || (isAdmin && isOwner && !isSuperAdmin));

                    return (
                        <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow relative transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] ${selected.has(c.id) ? "border-nwu-red ring-2 ring-nwu-red/20" : "border-gray-100 dark:border-gray-700"}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    {canEditThisClass && (
                                        <input
                                            type="checkbox"
                                            checked={selected.has(c.id)}
                                            onChange={() => toggleSelect(c.id)}
                                            aria-label={`Select ${c.name} for bulk action`}
                                            className="h-3.5 w-3.5 rounded border-gray-300 text-nwu-red focus:ring-nwu-red cursor-pointer"
                                        />
                                    )}
                                    <div className="h-8 w-8 bg-nwu-red/10 rounded-lg flex items-center justify-center">
                                        <BookOpen className="h-4 w-4 text-nwu-red" />
                                    </div>
                                </div>
                                {canEditThisClass && (
                                    <div className="scale-90 origin-right">
                                        <ClassCardActions
                                            classData={c}
                                            onEdit={() => setEditClass(c)}
                                            onArchive={() => setArchiveClass(c)}
                                        />
                                    </div>
                                )}
                            </div>

                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5 line-clamp-1" title={c.name}>{c.name}</h3>

                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 min-h-[32px] leading-snug">{c.description || "No description."}</p>

                            {/* Schedule display */}
                            {(c.schedule_days || c.start_time) && (
                                <div className="flex flex-col gap-0.5 mb-2 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                    {c.schedule_days && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-2.5 w-2.5" />
                                            <span className="truncate">{c.schedule_days}</span>
                                        </div>
                                    )}
                                    {c.start_time && c.end_time && (
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            <span>{format(parse(c.start_time, 'HH:mm:ss', new Date()), 'h:mm a')} – {format(parse(c.end_time, 'HH:mm:ss', new Date()), 'h:mm a')}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                                <div className="flex items-center text-[11px] text-gray-500 font-bold">
                                    <Users className="h-3 w-3 mr-1 text-gray-400" />
                                    {c.enrollments?.[0]?.count || 0}
                                </div>
                                <Link
                                    href={`/classes/${c.id}`}
                                    className="text-[11px] font-black text-nwu-red hover:underline uppercase tracking-wider"
                                >
                                    {(isSuperAdmin || (isAdmin && !isOwner)) ? "View" : "Manage"} &rarr;
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            {canAnyEdit && (
                <MultiDeleteBar
                    count={selected.size}
                    itemLabel={`class${selected.size !== 1 ? "es" : ""}`}
                    onDelete={handleBulkDelete}
                    onClear={() => setSelected(new Set())}
                    actionLabel="Archive"
                />
            )}

            {/* Modals lifted to grid level to fix z-index/transform issues */}
            <EditClassSlideOver
                isOpen={!!editClass}
                onClose={() => setEditClass(null)}
                classData={editClass}
            />

            {archiveClass && (
                <ConfirmationModal
                    isOpen={!!archiveClass}
                    onClose={() => setArchiveClass(null)}
                    onConfirm={async () => {
                        await deleteClass(archiveClass.id);
                        setArchiveClass(null);
                    }}
                    title="Archive Class"
                    message={`Are you sure you want to archive "${archiveClass.name}"? It will be removed from your active dashboard.`}
                    variant="warning"
                    confirmLabel="Archive"
                />
            )}
        </>
    );
}
