"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { useTransition } from "react";
import { useDebouncedCallback } from "use-debounce"; // Re-using this since it handles debounce cleaner than raw timeouts in handlers

export function Search({ placeholder }: { placeholder: string }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("query", term);
        } else {
            params.delete("query");
        }

        startTransition(() => {
            replace(`${pathname}?${params.toString()}`);
        });
    }, 300);

    return (
        <div className="relative">
            <SearchIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isPending ? "text-nwu-red animate-pulse" : "text-gray-400"}`} />
            <input
                type="text"
                placeholder={placeholder}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nwu-red w-full md:w-64"
                onChange={(e) => {
                    handleSearch(e.target.value);
                }}
                defaultValue={searchParams.get("query")?.toString()}
            />
        </div>
    );
}
