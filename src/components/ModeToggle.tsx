"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ModeToggle() {
    const { setTheme, theme } = useTheme();

    return (
        <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 p-1 rounded-full">
            <button
                onClick={() => setTheme("light")}
                className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow text-nwu-red' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
            >
                <Sun className="h-4 w-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'bg-gray-700 shadow text-nwu-red' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
            >
                <Moon className="h-4 w-4" />
            </button>
        </div>
    );
}
