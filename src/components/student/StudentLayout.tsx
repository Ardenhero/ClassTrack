"use client";

import React from "react";
import { StudentSidebar } from "./StudentSidebar";

export function StudentLayout({ 
    children, 
    studentName, 
    sin,
    imageUrl,
    status
}: { 
    children: React.ReactNode; 
    studentName: string; 
    sin: string;
    imageUrl?: string | null;
    status?: string;
}) {
    return (
        <div className="min-h-screen bg-transparent flex">
            {/* Sidebar */}
            <StudentSidebar studentName={studentName} sin={sin} imageUrl={imageUrl} status={status} />

            {/* Main Content */}
            <main className="flex-1 lg:ml-72 min-h-screen transition-all duration-300">
                {/* Spacer for mobile header */}
                <div className="h-16 lg:hidden" />
                
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
