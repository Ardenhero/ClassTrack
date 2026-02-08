"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

export function AttendanceFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Default to query param or today (client-side default)
    // We'll let server handle the true "default" logic, but visual default is today
    const dateParam = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        const params = new URLSearchParams(searchParams);
        if (newDate) {
            params.set("date", newDate);
        } else {
            params.delete("date");
        }
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <CalendarIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date:</span>
            <input
                type="date"
                value={dateParam}
                onChange={handleDateChange}
                className="block w-full text-sm text-gray-900 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-nwu-red focus:ring-nwu-red bg-transparent disabled:opacity-50"
                data-testid="attendance-date-picker"
            />
        </div>
    );
}
