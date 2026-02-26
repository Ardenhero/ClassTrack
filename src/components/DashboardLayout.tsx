"use client";

import { Sidebar } from "@/components/Sidebar";
import { useState, useEffect } from "react";
import { Menu, Fingerprint, X } from "lucide-react";
import { cn } from "@/utils/cn";
import ScanToastProvider from "@/components/ScanToastProvider";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true); // Default to true or checking localstorage in effect

    useEffect(() => {
        const stored = localStorage.getItem("sidebar_collapsed");
        if (stored) {
            setIsCollapsed(stored === "true");
        } else {
            setIsCollapsed(false);
        }
    }, []);

    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("sidebar_collapsed", String(newState));
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden bg-udemy-indigo text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
                <div className="flex items-center">
                    <Fingerprint className="h-6 w-6 text-nwu-red mr-2" />
                    <span className="font-bold text-lg">Attendance System</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu className="h-6 w-6" />
                </button>
            </div>

            {/* Sidebar (Desktop + Mobile Drawer) */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-40 bg-udemy-indigo transition-all duration-300 ease-in-out md:static md:translate-x-0 transform",
                isCollapsed ? "w-20" : "w-64",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Mobile Close Button */}
                <div className="absolute top-4 right-4 md:hidden z-50">
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white hover:text-gray-300">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                <Sidebar
                    onLinkClick={() => setIsMobileMenuOpen(false)}
                    isCollapsed={isCollapsed}
                    toggleCollapse={toggleCollapse}
                />
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>

            {/* Global Scan Toast Notifications */}
            <ScanToastProvider />
        </div>
    );
}
