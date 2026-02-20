"use client";

import { useProfile } from "@/context/ProfileContext";
import { AdminBiometricMatrix } from "@/components/AdminBiometricMatrix";
import { KioskHealthCard } from "@/components/KioskHealthCard";
import {
    Users, BookOpen, BarChart3, ChevronRight, Cpu, Building2,
    DoorClosed
} from "lucide-react";
import Link from "next/link";

/* ── Design tokens (from admin-console-improved.html) ────── */
const t = {
    bgBase: "#0c0e14",
    bgSurface: "#12151f",
    bgCard: "#1e2336",
    bgCardHover: "#242840",
    border: "rgba(255,255,255,0.07)",
    borderHover: "rgba(255,255,255,0.14)",
    text1: "#f0f2ff",
    text2: "#a8adc4",
    text3: "#6b7094",
    purple: "#4E2A84",
    purpleLight: "#a78bfa",
    green: "#22c55e",
    amber: "#f59e0b",
    red: "#f43f5e",
    blue: "#60a5fa",
};

/* ── Tab definitions (link to sub-pages) ───────────────── */
const tabs = [
    { label: "Overview", href: "/dashboard/admin", icon: Cpu },
    { label: "Rooms", href: "/dashboard/admin/rooms", icon: DoorClosed },
    { label: "Departments", href: "/dashboard/admin/departments", icon: Building2 },
    { label: "Devices", href: "/dashboard/admin/devices", icon: Cpu },
    { label: "Instructors", href: "/dashboard/admin/instructors", icon: Users },
];

/* ── Quick-access cards ────────────────────────────────── */
const quickCards = [
    {
        title: "All Classes",
        desc: "Oversee all scheduled classes across the system.",
        href: "/classes",
        icon: BookOpen,
        color: "blue" as const,
    },
    {
        title: "System Reports",
        desc: "View attendance analytics and performance reports.",
        href: "/reports",
        icon: BarChart3,
        color: "red" as const,
    },
];

const cardGlow = {
    blue: "radial-gradient(ellipse at top left, rgba(96,165,250,0.08), transparent 60%)",
    red: "radial-gradient(ellipse at top left, rgba(244,63,94,0.08), transparent 60%)",
    purple: "radial-gradient(ellipse at top left, rgba(167,139,250,0.09), transparent 60%)",
};

const iconBg = {
    blue: "rgba(96,165,250,0.12)",
    red: "rgba(244,63,94,0.12)",
    purple: "rgba(167,139,250,0.12)",
};

const iconColor = {
    blue: t.blue,
    red: t.red,
    purple: t.purpleLight,
};

export default function AdminDashboardPage() {
    const { profile } = useProfile();

    return (
        <div style={{ background: t.bgBase, minHeight: "100vh", fontFamily: "'DM Sans', 'Inter', sans-serif", color: t.text1 }}>

            {/* ── Top Bar ───────────────────────────────── */}
            <header style={{
                background: "rgba(18,21,31,0.85)",
                backdropFilter: "blur(20px)",
                borderBottom: `1px solid ${t.border}`,
                padding: "0 28px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                position: "sticky", top: 0, zIndex: 50, height: 58,
            }}>
                <span style={{ fontSize: 13, color: t.text3 }}>
                    Welcome back, <strong style={{ color: t.text2, fontWeight: 600 }}>{profile?.name || "Admin"}</strong>
                </span>

                {/* Tab bar */}
                <div style={{
                    display: "flex", gap: 2, background: "rgba(255,255,255,0.04)",
                    padding: 4, borderRadius: 10, border: `1px solid ${t.border}`,
                }}>
                    {tabs.map(tab => {
                        const isActive = tab.label === "Overview";
                        const Icon = tab.icon;
                        return (
                            <Link key={tab.label} href={tab.href} style={{
                                padding: "6px 13px", fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                                color: isActive ? "#111" : t.text3,
                                background: isActive ? "white" : "transparent",
                                borderRadius: 7, textDecoration: "none", display: "flex",
                                alignItems: "center", gap: 6, whiteSpace: "nowrap",
                                boxShadow: isActive ? "0 1px 6px rgba(0,0,0,0.3)" : "none",
                                transition: "all 0.18s",
                            }}>
                                <Icon style={{ width: 13, height: 13 }} />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>

                <div />
            </header>

            {/* ── Page Header ──────────────────────────── */}
            <div style={{
                padding: "28px 28px 20px",
                display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                borderBottom: `1px solid ${t.border}`,
            }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Admin Console</h1>
                    <p style={{ fontSize: 13, color: t.text3, marginTop: 3 }}>System management and configuration</p>
                </div>
                <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 20,
                    background: "rgba(78,42,132,0.2)",
                    border: "1px solid rgba(167,139,250,0.25)",
                    fontSize: 12, color: t.purpleLight, fontWeight: 500,
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: t.purpleLight, animation: "pulse 2s infinite",
                    }} />
                    System Active
                </div>
            </div>

            {/* ── Dashboard Grid ───────────────────────── */}
            <div style={{
                padding: "24px 28px",
                display: "grid", gridTemplateColumns: "1fr 340px",
                gap: 20, alignItems: "start",
            }}>

                {/* Left Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Quick Access Cards */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: t.text3, textTransform: "uppercase", marginBottom: 12 }}>
                            Quick Access
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            {quickCards.map(card => {
                                const Icon = card.icon;
                                return (
                                    <Link key={card.title} href={card.href} style={{
                                        background: t.bgCard, border: `1px solid ${t.border}`,
                                        borderRadius: 14, padding: 20, textDecoration: "none",
                                        position: "relative", overflow: "hidden",
                                        transition: "all 0.25s ease", display: "block",
                                    }}
                                        className="admin-card-hover"
                                    >
                                        <div style={{ position: "absolute", inset: 0, borderRadius: 14, opacity: 0, background: cardGlow[card.color], transition: "opacity 0.25s" }} className="admin-card-glow" />
                                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, position: "relative" }}>
                                            <div style={{
                                                width: 42, height: 42, borderRadius: 10,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                background: iconBg[card.color], color: iconColor[card.color],
                                            }}>
                                                <Icon style={{ width: 20, height: 20 }} />
                                            </div>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: 7,
                                                background: "rgba(255,255,255,0.04)",
                                                border: `1px solid ${t.border}`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                color: t.text3,
                                            }}>
                                                <ChevronRight style={{ width: 13, height: 13 }} />
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text1, marginBottom: 5, position: "relative" }}>{card.title}</div>
                                        <div style={{ fontSize: 12.5, color: t.text3, lineHeight: 1.55, position: "relative" }}>{card.desc}</div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sensor Memory Map */}
                    <AdminBiometricMatrix />
                </div>

                {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Kiosk Health */}
                    <KioskHealthCard />
                </div>
            </div>

            {/* pulse animation */}
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .admin-card-hover:hover { border-color: ${t.borderHover} !important; transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
                .admin-card-hover:hover .admin-card-glow { opacity: 1 !important; }
            `}</style>
        </div>
    );
}
