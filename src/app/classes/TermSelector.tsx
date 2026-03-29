"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, History } from "lucide-react";

interface Term {
    id: string;
    name: string;
    is_active: boolean;
    academic_years?: { name: string } | null;
}

interface TermSelectorProps {
    terms: Term[];
    selectedTermId: string;
}

export function TermSelector({ terms, selectedTermId }: TermSelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    function handleTermChange(termId: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (termId) {
            params.set("termId", termId);
        } else {
            params.delete("termId");
        }
        router.push(`/classes?${params.toString()}`);
    }

    const selectedTerm = terms.find(t => t.id === selectedTermId);

    return (
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-2 text-gray-400">
                <History className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Academic Period:</span>
            </div>

            <div className="relative group">
                <select
                    value={selectedTermId}
                    onChange={(e) => handleTermChange(e.target.value)}
                    className="pl-2 pr-8 py-1 bg-transparent border-none text-sm font-black text-gray-900 dark:text-white appearance-none cursor-pointer focus:ring-0 uppercase tracking-tight"
                >
                    {terms.map(term => (
                        <option key={term.id} value={term.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                            {term.academic_years?.name} {term.name} {term.is_active ? '(CURRENT)' : ''}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none transition-colors group-hover:text-nwu-red" />
            </div>

            {selectedTerm && !selectedTerm.is_active && (
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
            )}

            {selectedTerm && !selectedTerm.is_active && (
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800/30">
                    Historical View
                </span>
            )}
        </div>
    );
}
