"use client";

import { Sidebar } from "./Sidebar";
import { useState, useEffect } from "react";
import { Menu, Fingerprint, X } from "lucide-react";
import { cn } from "../utils/cn";

export default function DashboardLayout({
    children,
    isFullWidth = false,
}: {
    children: React.ReactNode;
    isFullWidth?: boolean;
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
        <div className="min-h-screen bg-transparent flex flex-col md:flex-row relative">
            
            {/* Mobile Header */}
            <div className="md:hidden bg-udemy-indigo text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
                <div className="flex items-center">
                    <Image src="/branding/logo.png" alt="ClassTrack" width={32} height={32} className="mr-2" />
                    <span className="font-bold text-lg">ClassTrack</span>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    aria-label="Open mobile menu"
                >
                    <Menu className="h-6 w-6" aria-hidden="true" />
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
                    <button 
                        onClick={() => setIsMobileMenuOpen(false)} 
                        className="text-white hover:text-gray-300"
                        aria-label="Close mobile menu"
                    >
                        <X className="h-6 w-6" aria-hidden="true" />
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
            <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen focus:outline-none">
                <div className={cn(isFullWidth ? "w-full" : "max-w-7xl mx-auto")}>
                    {children}
                </div>
            </main>
        </div>
    );
}
