"use client";

import { useState } from "react";
import { Plus, CalendarOff } from "lucide-react";
import { AddClassDialog } from "../../app/classes/AddClassDialog";
import { GlobalNoClassDialog } from "./GlobalNoClassDialog";

interface DashboardActionsProps {
    instructorId: string;
    classes: { id: string; name: string; schedule_days: string; term_id: string }[];
}

export function DashboardActions({ instructorId, classes }: DashboardActionsProps) {
    const [noClassOpen, setNoClassOpen] = useState(false);

    return (
        <div className="flex space-x-3">
            <button 
                onClick={() => setNoClassOpen(true)}
                className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-sm text-sm font-medium active:scale-95"
            >
                <CalendarOff className="h-4 w-4 mr-2" />
                Declare
            </button>

            <AddClassDialog
                trigger={
                    <button className="flex items-center px-4 py-2 bg-nwu-red text-white rounded-xl hover:bg-red-700 transition-all shadow-sm text-sm font-medium">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Class
                    </button>
                }
            />

            <GlobalNoClassDialog 
                isOpen={noClassOpen}
                onClose={() => setNoClassOpen(false)}
                instructorId={instructorId}
                classes={classes}
            />
        </div>
    );
}
