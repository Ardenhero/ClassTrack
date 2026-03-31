"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    QrCode,
    History,
    FileSignature,
    Settings,
    Info,
    LogOut,
    Menu,
    X,
    Moon,
    Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import { logoutStudent } from "@/app/student/portal/actions";
import { useRouter } from "next/navigation";
import Image from "next/image";

const NAV_ITEMS = [
    { name: "Dashboard", href: "/student/portal/dashboard", icon: LayoutDashboard },
    { name: "QR Scanner", href: "/student/portal/scanner", icon: QrCode },
    { name: "Attendance Records", href: "/student/portal/records", icon: History },
    { name: "Excuse Letter", href: "/student/portal/excuse", icon: FileSignature },
];

const SECONDARY_NAV = [
    { name: "Settings", href: "/student/portal/settings", icon: Settings },
    { name: "System Info", href: "/student/portal/sys-info", icon: Info },
];

export function StudentSidebar({ studentName, sin, imageUrl, status }: { studentName: string; sin: string; imageUrl?: string | null; status?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    const handleLogout = async () => {
        await logoutStudent();
        router.push("/student/portal");
    };

    const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
            <Link
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                    ? "bg-nwu-red text-white shadow-lg shadow-red-200 dark:shadow-red-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-nwu-red"
                    }`}
            >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                <span className="font-semibold text-sm">{item.name}</span>
                {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
            </Link>
        );
    };

    return (
        <>
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-40 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center">
                        <Image
                            src="/branding/student_logo_hd.png"
                            alt="ClassTrack"
                            width={32}
                            height={32}
                            className="w-full h-full object-contain rounded-full scale-110"
                        />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">ClassTrack</span>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
                    aria-expanded={isOpen}
                >
                    {isOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
                </button>
            </header>

            {/* Sidebar Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 bottom-0 w-72 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 z-50
                transition-transform duration-300 ease-in-out lg:translate-x-0
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
            `}>
                <div className="flex flex-col h-full p-6">
                    {/* Logo Section */}
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="w-12 h-12 flex items-center justify-center">
                            <Image
                                src="/branding/student_logo_hd.png"
                                alt="ClassTrack"
                                width={48}
                                height={48}
                                className="w-full h-full object-contain rounded-full scale-[1.3]"
                            />
                        </div>
                        <div>
                            <h1 className="font-black text-xl text-gray-900 dark:text-white leading-none">ClassTrack</h1>
                            <span className="text-[10px] font-bold text-nwu-red uppercase tracking-widest">Student Portal</span>
                        </div>
                    </div>

                    {/* Profile Summary */}
                    <div className="mb-8 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            {imageUrl ? (
                                <Image
                                    src={imageUrl}
                                    alt={studentName}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-nwu-red font-bold">
                                    {studentName.charAt(0)}
                                </div>
                            )}
                            <div className="overflow-hidden">
                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{studentName}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] text-gray-500 font-mono">{sin}</p>
                                    {status && (
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${status.toLowerCase() === 'active' || status.toLowerCase() === 'enrolled'
                                                ? 'bg-green-100 text-green-700'
                                                : status.toLowerCase() === 'graduated'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}>
                                            {status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                        <div className="px-2 mb-2">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Main Menu</span>
                        </div>
                        {NAV_ITEMS.map((item) => <NavLink key={item.name} item={item} />)}

                        <div className="px-2 mt-8 mb-2">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">System</span>
                        </div>
                        {SECONDARY_NAV.map((item) => <NavLink key={item.name} item={item} />)}
                    </nav>

                    {/* Bottom Section */}
                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        {mounted && (
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold text-sm"
                                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                            >
                                {theme === "dark" ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
                                <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-semibold text-sm"
                            aria-label="Sign out"
                        >
                            <LogOut className="w-5 h-5" aria-hidden="true" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
