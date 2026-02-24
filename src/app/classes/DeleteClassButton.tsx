"use client";

import { Archive } from "lucide-react";
import { deleteClass } from "./actions";

export function DeleteClassButton({ id }: { id: string }) {
    return (
        <button
            onClick={async () => {
                if (confirm("Archive this class? It can be restored later from the Archived page.")) {
                    await deleteClass(id);
                }
            }}
            className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
            title="Archive Class"
        >
            <Archive className="h-4 w-4" />
        </button>
    );
}
