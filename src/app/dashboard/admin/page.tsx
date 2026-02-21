"use client";

import { AdminBiometricMatrix } from "@/components/AdminBiometricMatrix";
import { BookOpen, BarChart3, ChevronRight } from "lucide-react";
import Link from "next/link";

const quickCards = [
    {
        title: "All Classes",
        desc: "Oversee all scheduled classes across the system.",
        href: "/classes",
        icon: BookOpen,
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
        title: "System Reports",
        desc: "View attendance analytics and performance reports.",
        href: "/reports",
        icon: BarChart3,
        color: "bg-nu-500/10 text-nu-400 border-nu-500/20",
    },
];

export default function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            {/* Quick Access Cards */}
            <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-4 flex items-center gap-2">
                    <div className="h-px bg-white/10 flex-1"></div>
                    Quick Access
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {quickCards.map(card => {
                        const Icon = card.icon;
                        return (
                            <Link key={card.title} href={card.href}
                                className="group block glass-card p-6 md:p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,0,0,0.5)] border-t border-t-white/10 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-[60px] -mr-16 -mt-16 pointer-events-none group-hover:bg-white/10 transition-colors duration-700"></div>
                                <div className="relative z-10">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner backdrop-blur-md ${card.color}`}>
                                            <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                                        </div>
                                        <div className="w-10 h-10 rounded-xl glass-panel border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/20 group-hover:border-white/30 transition-all duration-300 shadow-sm">
                                            <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                                        </div>
                                    </div>
                                    <div className="text-lg font-black tracking-wide text-white mb-2 drop-shadow-sm">{card.title}</div>
                                    <div className="text-sm font-medium text-gray-400 leading-relaxed">{card.desc}</div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Sensor Memory Map */}
            <div className="rounded-3xl overflow-hidden pt-4">
                <AdminBiometricMatrix />
            </div>
        </div>
    );
}
