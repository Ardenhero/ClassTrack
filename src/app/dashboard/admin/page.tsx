"use client";

import { AdminBiometricMatrix } from "@/components/AdminBiometricMatrix";
import { BookOpen, BarChart3, ChevronRight, ShieldAlert, Shield, Trash2 } from "lucide-react";
import Link from "next/link";

const quickCards = [
    {
        title: "All Classes",
        desc: "Oversee all scheduled classes across the system.",
        href: "/classes",
        icon: BookOpen,
        color: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
        title: "System Reports",
        desc: "View attendance analytics and performance reports.",
        href: "/reports",
        icon: BarChart3,
        color: "bg-red-50 text-red-600 border-red-100",
    },
    {
        title: "Audit Trail",
        desc: "Forensic log of all administrative actions.",
        href: "/dashboard/admin/audit-logs",
        icon: ShieldAlert,
        color: "bg-purple-50 text-purple-600 border-purple-100",
    },
    {
        title: "Security",
        desc: "Reset passwords, PINs, and manage user access.",
        href: "/dashboard/admin/security",
        icon: Shield,
        color: "bg-amber-50 text-amber-600 border-amber-100",
    },
    {
        title: "Deletion Requests",
        desc: "Review instructor requests to permanently delete archived items.",
        href: "/dashboard/admin/deletion-requests",
        icon: Trash2,
        color: "bg-red-50 text-red-600 border-red-100",
    },
];


export default function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            {/* Quick Access Cards */}
            <div>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-4">
                    Quick Access
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {quickCards.map(card => {
                        const Icon = card.icon;
                        return (
                            <Link key={card.title} href={card.href}
                                className="group block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${card.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="w-8 h-8 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-gray-600 group-hover:bg-gray-100 transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-gray-900 mb-1">{card.title}</div>
                                <div className="text-sm text-gray-500 leading-relaxed">{card.desc}</div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Sensor Memory Map */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <AdminBiometricMatrix />
            </div>
        </div>
    );
}
