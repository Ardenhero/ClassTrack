"use client";

import { Trash2 } from "lucide-react";
import { deleteClass } from "./actions";

export function DeleteClassButton({ id }: { id: string }) {
    return (
        <button
            onClick={async () => {
                if (confirm("Are you sure? This will remove the class along with all student enrollments.")) {
                    await deleteClass(id);
                }
            }}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
        >
            <Trash2 className="h-4 w-4" />
        </button>
    );
}
