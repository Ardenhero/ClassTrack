"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface StudentSearchProps {
    onSearch: (query: string) => void;
}

export function StudentSearch({ onSearch }: StudentSearchProps) {
    const [query, setQuery] = useState("");

    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    onSearch(e.target.value);
                }}
                placeholder="Filter students..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red transition-colors"
            />
        </div>
    );
}
