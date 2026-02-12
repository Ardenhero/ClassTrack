"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/profile/actions";
import { useProfile } from "@/context/ProfileContext";

interface ProfileDropdownProps {
    user: User | null;
}

export function ProfileDropdown({ user }: ProfileDropdownProps) {
    // 1. Hooks first
    const { profile, isSwitching } = useProfile();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 2. Conditional Return
    if (!user) return null;

    // 3. Derived State / Helpers
    // STRICT UI: Show Active Profile Name if available
    const displayName = isSwitching ? "Switching..." : (profile?.name || user.user_metadata.full_name || user.email || "User");
    const initials = isSwitching ? "..." : (displayName[0] || "U").toUpperCase();

    // Show Active Profile Role
    const displayRole = isSwitching ? "Please wait" : (profile?.role === 'admin' ? 'Administrator' : (profile?.role === 'instructor' ? 'Instructor' : (user.user_metadata.role || "Instructor")));

    const handleSignOut = async () => {
        await signOutAction();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-3 bg-white dark:bg-gray-800 p-1.5 rounded-full shadow-sm pr-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer border border-gray-100 dark:border-gray-700"
            >
                <div className="h-8 w-8 bg-nwu-red text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {initials}
                </div>
                <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {displayName}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{displayRole}</p>
                </div>
            </div>

            {/* Dropdown Content */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">

                    {/* Header / User Info */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="h-12 w-12 bg-nwu-red text-white rounded-full flex items-center justify-center font-bold text-lg">
                                {initials}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-gray-100">{displayName}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
