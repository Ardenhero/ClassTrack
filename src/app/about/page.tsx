"use client";

import DashboardLayout from "../../components/DashboardLayout";
import {
    Code, Database, Rocket, Sparkles,
    Server, Globe, Cpu, Shield, Fingerprint, Wifi,
    BarChart3, Users, MonitorSmartphone, Activity,
    CpuIcon, Terminal, LucideIcon,
    Zap, Coffee, Heart, CheckCircle2, RefreshCw, Eye
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

// --- Components ---

interface SectionTitleProps {
    title: string;
    subtitle?: string;
    centered?: boolean;
}

const SectionTitle = ({ title, subtitle, centered = true }: SectionTitleProps) => (
    <div className={cn("mb-16 space-y-4", centered ? "text-center" : "text-left")}>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">
            {title}
        </h2>
        <div className={cn("h-1.5 w-24 bg-nwu-gold rounded-full", centered ? "mx-auto" : "ml-0")} />
        {subtitle && <p className="text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto">{subtitle}</p>}
    </div>
);

// --- 1. Interactive Lifecycle ---

const LifecycleStep = ({ 
    icon: Icon, 
    title, 
    isActive, 
    onClick 
}: { 
    icon: LucideIcon; 
    title: string; 
    isActive: boolean; 
    onClick: () => void;
}) => (
    <button 
        onClick={onClick}
        className={cn(
            "relative flex flex-col items-center p-6 rounded-[2rem] transition-all duration-500 border-2",
            isActive 
                ? "bg-nwu-red text-white border-nwu-red shadow-[0_20px_40px_rgba(151,13,11,0.3)] scale-110 z-10" 
                : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-100 dark:border-gray-700 hover:border-nwu-red/30"
        )}
    >
        <Icon size={32} className={cn("mb-3 transition-transform duration-500", isActive && "scale-110")} />
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
        {isActive && (
            <div className="absolute -bottom-2 translate-y-full flex flex-col items-center">
                <div className="w-0.5 h-8 bg-nwu-red animate-pulse" />
            </div>
        )}
    </button>
);

const AttendanceLifecycle = () => {
    const [activeStep, setActiveStep] = useState(0);
    const steps = [
        {
            title: "Touch",
            icon: Fingerprint,
            desc: "AS608 Optical Sensor captures minutiae points from the ridges of the finger. DSP processes the image into a unique 512-byte template.",
            sub: "Click to simulate scan animation",
            code: "// UART Packet 57600bps\n[0xEF, 0x01, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x01, 0x00, 0x05]"
        },
        {
            title: "Process",
            icon: Cpu,
            desc: "ESP32 (Dual-core LX6) receives UART packets, validates the checksum, and maps the Local ID to a Student Information Number (SIN).",
            sub: "UART Handling Logic",
            code: "void handleFingerprint() {\n  if (finger.getImage() == FINGERPRINT_OK) {\n    int id = finger.fingerFastSearch();\n    sendToBackend(id);\n  }\n}"
        },
        {
            title: "Cloud",
            icon: Server,
            desc: "The payload is sent via HTTPS POST to Supabase Edge Runtime. Row Level Security (RLS) ensures only authenticated IoT nodes can push data.",
            sub: "Supabase Realtime Pulse",
            code: "const { data, error } = await supabase\n  .from('attendance_logs')\n  .insert([{ student_id, kiosk_id }]);"
        },
        {
            title: "Web",
            icon: MonitorSmartphone,
            desc: "Administrators see the update instantly via WebSocket subscription. Dashboard charts and activity feeds reflect the new check-in in < 200ms.",
            sub: "Live UI Feedback",
            code: "supabase.channel('attendance_logs')\n  .on('postgres_changes', (p) => {\n    updateDashboard(p.new);\n  }).subscribe();"
        }
    ];

    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[3rem] p-8 md:p-12 border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20 relative">
                {/* Horizontal Line Connector (not on mobile) */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 dark:bg-gray-800 -translate-y-1/2 hidden md:block" />
                
                {steps.map((step, i) => (
                    <LifecycleStep 
                        key={i} 
                        {...step} 
                        isActive={activeStep === i} 
                        onClick={() => setActiveStep(i)} 
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-6">
                    <span className="text-[10px] font-black text-nwu-red uppercase tracking-[0.3em] bg-nwu-red/10 px-3 py-1 rounded-full">
                        Step 0{activeStep + 1}
                    </span>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">
                        {steps[activeStep].sub}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                        {steps[activeStep].desc}
                    </p>
                </div>
                <div className="bg-gray-950 rounded-[2rem] p-8 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Terminal size={100} className="text-white" />
                    </div>
                    <pre className="text-sm font-mono text-blue-400 overflow-x-auto">
                        <code>{steps[activeStep].code}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
};

// --- 2. The Lab (Interactive Hardware Showcase) ---

const HardwareLab = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [ledOn, setLedOn] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState<string[]>(["[SYSTEM] Booting ClassTrack OS...", "[SYSTEM] ESP32-WROOM Ready.", "[SYSTEM] AS608 Serial: OK"]);

    const addLog = (msg: string) => {
        setTerminalLogs(prev => [msg, ...prev].slice(0, 5));
    };

    const handleScan = () => {
        if (isScanning) return;
        setIsScanning(true);
        addLog("[SENSOR] Finger detected. Scanning...");
        setTimeout(() => {
            setIsScanning(false);
            addLog("[SENSOR] Match found: ID #127 (Damaso, A.H.)");
            setLedOn(true);
            setTimeout(() => setLedOn(false), 2000);
        }, 1500);
    };

    const handleReset = () => {
        addLog("[SYSTEM] Rebooting...");
        setTimeout(() => setTerminalLogs(["[SYSTEM] Booting ClassTrack OS...", "[SYSTEM] ESP32-WROOM Ready.", "[SYSTEM] AS608 Serial: OK"]), 500);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-square max-w-md mx-auto bg-gray-100 dark:bg-gray-800/50 rounded-[4rem] border-8 border-white dark:border-gray-800 shadow-2xl flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-nwu-red/5 to-transparent"></div>
                
                {/* Virtual Module Visuals */}
                <div className="relative space-y-12 flex flex-col items-center">
                    {/* Status Indicator */}
                    <div className={cn(
                        "h-4 w-12 rounded-full border-2 transition-all duration-300",
                        ledOn ? "bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "bg-gray-300 dark:bg-gray-700 border-gray-400"
                    )} />

                    {/* Fingerprint Sensor Button */}
                    <button 
                        onClick={handleScan}
                        disabled={isScanning}
                        className={cn(
                            "h-40 w-40 rounded-full border-8 transition-all duration-500 flex items-center justify-center group relative",
                            isScanning 
                                ? "border-blue-500 bg-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.3)]" 
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-nwu-red/50 shadow-xl"
                        )}
                    >
                        <Fingerprint size={80} className={cn(
                            "transition-all duration-500",
                            isScanning ? "text-blue-500 scale-110" : "text-gray-300 dark:text-gray-600 group-hover:text-nwu-red"
                        )} />
                        {isScanning && <div className="absolute inset-4 rounded-full border-2 border-blue-400 animate-ping" />}
                    </button>

                    {/* Reset Button */}
                    <button 
                        onClick={handleReset}
                        className="p-4 bg-gray-200 dark:bg-gray-700 rounded-2xl hover:bg-nwu-red hover:text-white transition-all group"
                    >
                        <RefreshCw size={24} className="group-active:rotate-180 transition-transform" />
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                <div className="p-8 bg-gray-950 rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-nwu-red animate-pulse" />
                            Live Hardware Feed
                        </h4>
                        <Terminal size={16} className="text-gray-500" />
                    </div>
                    <div className="font-mono text-sm space-y-3">
                        {terminalLogs.map((log, i) => (
                            <div key={i} className={cn(
                                "flex gap-4",
                                log.includes("[SENSOR]") ? "text-blue-400" : 
                                log.includes("Match") ? "text-green-400 font-bold" : 
                                log.includes("SYSTEM") ? "text-gray-400" : "text-gray-600"
                            )}>
                                <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                                <span>{log}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <Wifi className="text-nwu-red mb-4" />
                        <h5 className="text-gray-900 dark:text-white font-black text-[10px] uppercase tracking-widest mb-1">State</h5>
                        <p className="text-xs font-bold text-gray-500 italic">Connected • 12ms</p>
                    </div>
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <Activity className="text-nwu-red mb-4" />
                        <h5 className="text-gray-900 dark:text-white font-black text-[10px] uppercase tracking-widest mb-1">Load</h5>
                        <p className="text-xs font-bold text-gray-500 italic">14% ESP32 Core 0</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Components ---

export default function AboutPage() {
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState({ loc: 0, bugs: 0, coffee: 0, passion: 0 });

    useEffect(() => {
        setMounted(true);
        // Animate stats
        const timer = setTimeout(() => {
            setStats({ loc: 12500, bugs: 98, coffee: 450, passion: 100 });
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const team = [
        {
            name: "Arden Hero Damaso",
            role: "Full Stack Developer",
            initials: "AH",
            image: "/team/arden.png",
            color: "from-nwu-red to-orange-500",
            icon: Code,
            quote: "Building the future, one line of code at a time.",
        },
        {
            name: "Clemen Jay Luis",
            role: "Frontend Developer",
            initials: "CJ",
            image: "/team/clemen.png",
            color: "from-blue-500 to-cyan-400",
            icon: Sparkles,
            quote: "Designing experiences that delight and inspire.",
        },
        {
            name: "Ace Donner Dane Asuncion",
            role: "Backend Developer",
            initials: "AD",
            image: "/team/ace.png",
            color: "from-purple-500 to-pink-500",
            icon: Database,
            quote: "Ensuring stability and performance at scale.",
        },
    ];

    const hardwareSpecs = [
        {
            title: "ESP32-WROOM-32D",
            icon: Cpu,
            desc: "The dual-core heart of our kiosks. Running at 240MHz with 4MB SPI Flash, it handles real-time UART processing and secure HTTPS handshakes simultaneously.",
            specs: ["Dual XTENSA® LX6 Core", "240MHz Clock Speed", "4MB SPI Flash Memory", "Built-in PCB Antenna"]
        },
        {
            title: "AS608 Optical Sensor",
            icon: Fingerprint,
            desc: "Highly accurate DSP-based scanning. It utilizes an optical imaging lens to extract minutiae and convert biometric patterns into secure digital templates.",
            specs: ["UART @ 57600bps", "512 Finger Buffer", "DSP min-matching", "Optical 500 DPI"]
        }
    ];

    const techStack = [
        { name: "Next.js 14 (App Router)", icon: Globe, color: "text-blue-500" },
        { name: "Supabase (PostgreSQL)", icon: Database, color: "text-emerald-500" },
        { name: "Supabase Auth + RLS", icon: Shield, color: "text-orange-500" },
        { name: "Supabase Realtime (WebSocket)", icon: Wifi, color: "text-cyan-500" },
        { name: "ESP32 IoT Nodes", icon: CpuIcon, color: "text-nwu-red" },
        { name: "Vercel (Edge Network)", icon: Server, color: "text-gray-900 dark:text-white" },
    ];

    const statsData = [
        { label: "Lines of Code", value: stats.loc.toLocaleString() + "+", icon: Code, color: "text-blue-500" },
        { label: "Bugs Fixed", value: stats.bugs + "%", icon: Zap, color: "text-nwu-red" },
        { label: "Coffee Consumed", value: stats.coffee + "L", icon: Coffee, color: "text-nwu-gold" },
        { label: "Passion Level", value: stats.passion + "%", icon: Heart, color: "text-pink-500" },
    ];

    if (!mounted) return null;

    return (
        <DashboardLayout>
            <div className="relative min-h-screen max-w-7xl mx-auto px-4 md:px-8 py-12 space-y-40 overflow-hidden">
                
                {/* 1. Hero Section */}
                <section className="text-center relative py-20">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-nwu-red/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
                    <div className="space-y-6">
                        <span className="inline-block py-2 px-6 rounded-full bg-nwu-red/10 text-nwu-red text-[10px] font-black tracking-[0.3em] uppercase border border-nwu-red/20 shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
                             Excellence in Engineering • v1.0
                        </span>
                        <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-none italic uppercase">
                            The Tech <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-red via-nwu-gold to-orange-500">
                                Behind the Logic
                            </span>
                        </h1>
                        <p className="max-w-3xl mx-auto text-xl text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                            ClassTrack is more than a portal; it&apos;s a synchronized biometric ecosystem designed to bridge the gap between IoT reliability and academic integrity at Northwestern University.
                        </p>
                    </div>
                </section>

                {/* 2. Lifecycle Interactive */}
                <section>
                    <SectionTitle 
                        title="The Life of a Log" 
                        subtitle="Follow the journey of a single fingerprint scan as it travels from the kiosk to your screen."
                    />
                    <AttendanceLifecycle />
                </section>

                {/* 3. Hardware Deep-Dive */}
                <section>
                    <SectionTitle 
                        title="Hardware Core" 
                        subtitle="The industrial-grade components powering our physical attendance kiosks."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {hardwareSpecs.map((hardware, i) => (
                            <div key={i} className="group bg-white dark:bg-gray-900/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl transition-all duration-500 hover:-translate-y-2">
                                <div className="flex items-center gap-6 mb-8 text-nwu-red">
                                    <hardware.icon size={48} className="group-hover:scale-110 transition-transform duration-500" />
                                    <h3 className="text-3xl font-black uppercase tracking-tighter italic text-gray-900 dark:text-white">{hardware.title}</h3>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8 border-l-4 border-nwu-red/30 pl-6">
                                    {hardware.desc}
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {hardware.specs.map((spec, j) => (
                                        <div key={j} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <CheckCircle2 size={14} className="text-nwu-red" />
                                            <span className="text-[10px] font-black uppercase tracking-tight text-gray-600 dark:text-gray-300">{spec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. The Lab Interactive */}
                <section>
                    <SectionTitle 
                        title="The Lab" 
                        subtitle="Interact with a virtual ClassTrack hardware module to see system behaviors and state changes."
                    />
                    <HardwareLab />
                </section>

                {/* 5. System Overview & Tech Stack */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-900/40 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800">
                        <SectionTitle title="Architecture" centered={false} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[
                                { title: "4 ROLES", desc: "Administrator, Dept Admin, Instructor, Student.", icon: Users },
                                { title: "DEPT ISOLATION", desc: "Fully scoped multi-department support with rigid data isolation.", icon: Shield },
                                { title: "BIOMETRIC KIOSKS", desc: "Seamless logging via custom ESP32 + AS608 hardware nodes.", icon: Fingerprint },
                                { title: "REAL-TIME SYNC", desc: "Instant WebSocket communication for dashboards and scanners.", icon: Activity }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-6">
                                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <item.icon className="text-nwu-red" size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1">{item.title}</h4>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-2xl">
                        <SectionTitle title="Tech Stack" centered={false} />
                        <div className="space-y-4">
                            {techStack.map((tech, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 group hover:bg-white dark:hover:bg-gray-900 transition-colors">
                                    <tech.icon className={cn("transition-transform group-hover:scale-110", tech.color)} size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">{tech.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 6. Stats Section */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {statsData.map((stat, i) => (
                        <div key={i} className="group flex flex-col items-center gap-6 p-10 bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl transition-all hover:bg-nwu-red hover:text-white">
                            <div className="h-16 w-16 rounded-[1.5rem] bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <stat.icon className={cn("transition-colors group-hover:text-white", stat.color)} size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-black tracking-tighter uppercase mb-1">{stat.value}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </section>

                {/* 7. Team Section */}
                <section>
                    <SectionTitle 
                        title="Founding Architects" 
                        subtitle="The engineering trio behind ClassTrack's core infrastructure."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {team.map((member, index) => (
                            <div
                                key={index}
                                className="group relative bg-white dark:bg-gray-900 rounded-[3rem] p-10 transition-all duration-500 hover:-translate-y-4 hover:shadow-[0_40px_80px_-15px_rgba(151,13,11,0.2)] border border-gray-100 dark:border-gray-800"
                            >
                                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${member.color} rounded-t-[3rem] transition-all`}></div>
                                
                                <div className="relative mx-auto w-40 h-40 mb-10">
                                    <div className="absolute inset-0 rounded-full bg-nwu-red/10 animate-ping group-hover:animate-none opacity-0 group-hover:opacity-100"></div>
                                    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl transition-transform duration-700 group-hover:scale-105">
                                        <Image
                                            src={member.image}
                                            alt={member.name}
                                            width={160}
                                            height={160}
                                            className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-4xl text-gray-200 dark:text-gray-800 select-none opacity-20">
                                            {member.initials}
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-4 -right-4 h-12 w-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-xl border border-gray-100 dark:border-gray-700 transition-transform group-hover:rotate-12">
                                        <member.icon size={20} className="text-nwu-red" />
                                    </div>
                                </div>

                                <div className="text-center">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter italic">{member.name}</h3>
                                    <p className={`text-xs font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r ${member.color} mb-6`}>
                                        {member.role}
                                    </p>
                                    <p className="text-gray-500 dark:text-gray-400 italic font-medium leading-relaxed">
                                        &quot;{member.quote}&quot;
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 8. Roadmap */}
                <section className="relative bg-gray-950 rounded-[4rem] p-12 md:p-24 overflow-hidden border border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-nwu-red/10 to-transparent"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row gap-16 items-center">
                        <div className="flex-1 space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-nwu-gold/10 rounded-full border border-nwu-gold/20 text-nwu-gold text-[10px] font-black uppercase tracking-widest">
                                <Rocket size={14} />
                                Infrastructure Evolution
                            </div>
                            <h2 className="text-5xl md:text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
                                Future <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-gold to-orange-500">Milestones</span>
                            </h2>
                            <p className="text-gray-400 text-lg leading-relaxed font-medium italic">
                                ClassTrack is a living system. We are constantly researching New technologies to improve security and student engagement.
                            </p>
                        </div>
                        <div className="flex-1 grid grid-cols-1 gap-6 w-full lg:w-auto">
                            {[
                                { title: "AI-Powered Analytics", status: "Researching", icon: BarChart3 },
                                { title: "Native Mobile App", status: "Planned", icon: MonitorSmartphone },
                                { title: "Face Recognition", status: "Exploring", icon: Eye },
                                { title: "Offline Kiosk Mode", status: "In Progress", icon: Wifi }
                            ].map((milestone, i) => (
                                <div key={i} className="group flex items-center gap-6 p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] transition-all hover:bg-white/10 hover:border-nwu-red/30">
                                    <milestone.icon className="text-white opacity-40 group-hover:opacity-100 group-hover:text-nwu-red transition-all" size={32} />
                                    <div>
                                        <h3 className="text-white font-black uppercase tracking-tight italic">{milestone.title}</h3>
                                        <span className="text-[8px] font-black text-nwu-gold uppercase tracking-[0.2em]">{milestone.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="text-center text-gray-500 dark:text-gray-600 text-[9px] font-black uppercase tracking-[1em] opacity-30 pt-40">
                    Proprietary of ClassTrack Team • Northwestern University • Building the Future
                </div>
            </div>
        </DashboardLayout>
    );
}
