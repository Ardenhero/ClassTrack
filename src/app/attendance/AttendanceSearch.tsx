"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function AttendanceSearch() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";
    const [query, setQuery] = useState(initialQuery);
    
    const debouncedQuery = useDebouncedValue(query, 300);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (debouncedQuery) {
            params.set("q", debouncedQuery);
        } else {
            params.delete("q");
        }
        router.replace(`${window.location.pathname}?${params.toString()}`);
    }, [debouncedQuery, router]);

    return (
        <div className="relative w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="h-4 w-4" />
            </div>
            <input
                type="text"
                placeholder="Search by name or SIN..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
        </div>
    );
}
