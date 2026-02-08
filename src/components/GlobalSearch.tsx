"use client";

import { useState, useEffect, useRef } from "react";
import { Search as SearchIcon, Loader2, BookOpen, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
// Note: We need to make sure use-debounce is available or just implement simple debounce
// I'll implement a simple debounce inside useEffect to avoid dependency issues

// ... imports

interface SearchResult {
    classes: { id: string; name: string }[];
    students: { id: string; name: string; year_level: string }[];
}

interface GlobalSearchProps {
    placeholder?: string;
    type?: "all" | "classes" | "students";
}

export function GlobalSearch({ placeholder = "Search...", type = "all" }: GlobalSearchProps) {
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("query") || "");
    const [results, setResults] = useState<SearchResult>({ classes: [], students: [] });
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Debounce logic handled via useEffect
    useEffect(() => {
        const timer = setTimeout(async () => {
            // 1. Update URL for filtering
            const params = new URLSearchParams(window.location.search);
            if (query) {
                params.set("query", query);
            } else {
                params.delete("query");
            }
            router.replace(`${window.location.pathname}?${params.toString()}`);

            // 2. Fetch autocomplete suggestions
            // Only fetch if interactions are happening or query is non-empty
            if (query.trim().length === 0) {
                setResults({ classes: [], students: [] });
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=${type}`);
                const data = await res.json();
                setResults(data);

                // Show dropdown if input is focused (user is typing)
                if (document.activeElement === inputRef.current) {
                    setShowDropdown(true);
                }
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, router, type]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectClass = (name: string) => {
        setQuery(name);
        setShowDropdown(false);
        router.push(`/classes?query=${encodeURIComponent(name)}`);
    };

    const handleSelectStudent = (name: string) => {
        // Navigate to students page filtered by this name
        setQuery(name); // Keep name in input to persist filter
        setShowDropdown(false);
        router.push(`/students?query=${encodeURIComponent(name)}`);
    };

    const hasResults = results.classes.length > 0 || results.students.length > 0;

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-nwu-red/20 focus:border-nwu-red outline-none text-sm text-gray-900 dark:text-gray-100"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.length > 0) setShowDropdown(true);
                    }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                    /
                </div>
            </div>

            {showDropdown && query.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">

                    {!loading && !hasResults && (
                        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            No results found for &quot;{query}&quot;
                        </div>
                    )}

                    {/* Classes Section */}
                    {results.classes.length > 0 && (
                        <div className="border-b border-gray-50 dark:border-gray-800 last:border-none">
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Classes
                            </div>
                            {results.classes.map((c) => (
                                <button
                                    key={c.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur
                                        handleSelectClass(c.name);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center group"
                                >
                                    <div className="p-2 bg-nwu-red/10 rounded-lg mr-3 text-nwu-red group-hover:bg-nwu-red group-hover:text-white transition-colors">
                                        <BookOpen className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Students Section */}
                    {results.students.length > 0 && (
                        <div>
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Students
                            </div>
                            {results.students.map((s) => (
                                <button
                                    key={s.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur
                                        handleSelectStudent(s.name);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center group"
                                >
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-3 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{s.year_level}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
