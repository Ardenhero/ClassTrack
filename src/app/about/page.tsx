"use client";

import DashboardLayout from "../../components/DashboardLayout";
import {
    Code, Database, Rocket, Sparkles,
    Server, Cpu, Shield, Fingerprint,
    BarChart3, Users, MonitorSmartphone,
    Terminal, LucideIcon, Bell,
    Zap, Coffee, Heart, CheckCircle2, RefreshCw, Eye
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

// --- Custom Components ---

const SectionTitle = ({ title, subtitle, centered = true }: { title: string; subtitle?: string; centered?: boolean }) => (
    <div className={cn("mb-16 space-y-4", centered ? "text-center" : "text-left")}>
        <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
            {title}
        </h2>
        <div className={cn("h-1.5 w-24 bg-nwu-gold rounded-full", centered ? "mx-auto" : "ml-0")} />
        {subtitle && <p className="text-gray-500 dark:text-gray-400 font-medium max-w-3xl mx-auto text-lg leading-relaxed">{subtitle}</p>}
    </div>
);

// --- 1. Lifecycle Interactive ---

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
                ? "bg-nwu-red text-white border-nwu-red shadow-[0_20px_40px_rgba(151,13,11,0.2)] scale-105 z-10" 
                : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-100 dark:border-gray-700 hover:border-nwu-red/30"
        )}
    >
        <Icon size={28} className={cn("mb-3 transition-transform duration-500", isActive && "scale-110")} />
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
    </button>
);

const AttendanceLifecycle = () => {
    const [activeStep, setActiveStep] = useState(0);
    const steps = [
        {
            title: "Touch",
            icon: Fingerprint,
            desc: "The AS608 Optical Sensor utilizes high-speed DSP (Digital Signal Processing) to capture 500 DPI images of the finger ridges. It converts these patterns into a 512-byte encrypted template in < 0.1s.",
            code: "// UART Packet 57600bps\n[0xEF, 0x01, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x01, 0x00, 0x05]"
        },
        {
            title: "Process",
            icon: Cpu,
            desc: "An ESP32-WROOM-32D acts as the localized gateway. It receives the scan result via UART, verifies the student identity against its local buffer, and prepares a JSON payload for cloud synchronization.",
            code: "void handleFingerprint() {\n  if (finger.FastSearch() == FINGERPRINT_OK) {\n    uint16_t studentID = finger.fingerID;\n    syncToCloud(studentID);\n  }\n}"
        },
        {
            title: "Cloud",
            icon: Server,
            desc: "The payload travels via secure HTTPS to Supabase Edge Functions. PostgREST and Row Level Security handle the entry, while Supabase Realtime broadcasts the event to all authenticated clients.",
            code: "supabase.from('attendance_logs')\n  .insert({ student_sin, kiosk_id })\n  .then(resp => handleBroadcast(resp));"
        },
        {
            title: "Web",
            icon: MonitorSmartphone,
            desc: "Instructor and Administrator dashboards update instantly via WebSocket (Pusher-like) protocol. Parents receive an automated email notification if an absence pattern is detected.",
            code: "supabase.channel('logs')\n  .on('postgres_changes', (p) => {\n    showLiveAlert(p.new.student_name);\n  }).subscribe();"
        }
    ];

    return (
        <div className="bg-white dark:bg-gray-900 shadow-2xl rounded-[3rem] p-8 md:p-12 border border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
                {steps.map((step, i) => (
                    <LifecycleStep key={i} {...step} isActive={activeStep === i} onClick={() => setActiveStep(i)} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Technical Deep-Dive</h3>
                    <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed text-lg">
                        {steps[activeStep].desc}
                    </p>
                </div>
                <div className="bg-gray-950 rounded-[2rem] p-8 border border-white/10 font-mono text-sm text-blue-400 overflow-x-auto">
                    <code>{steps[activeStep].code}</code>
                </div>
            </div>
        </div>
    );
};

// --- 2. Hardware Lab ---

const HardwareLab = () => {
    const [logs, setLogs] = useState<string[]>(["[SYSTEM] Booting ClassTrack OS...", "[SYSTEM] ESP32 Ready.", "[SYSTEM] AS608 Serial: OK"]);
    const [ledOn, setLedOn] = useState(false);

    const handleAction = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 5));
        if (msg.includes("Scan")) {
            setLedOn(true);
            setTimeout(() => setLedOn(false), 1500);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-[4rem] aspect-square flex flex-col items-center justify-center gap-12 border-8 border-white dark:border-gray-800 shadow-2xl relative">
                <div className={cn("w-12 h-3 rounded-full border-2 transition-all", ledOn ? "bg-green-500 border-green-400 shadow-[0_0_15px_green]" : "bg-gray-300 dark:bg-gray-700")} />
                <button onClick={() => handleAction("[SENSOR] Finger Scan Detected!")} className="w-32 h-32 rounded-full bg-white dark:bg-gray-900 border-4 border-gray-200 dark:border-gray-700 shadow-xl flex items-center justify-center hover:border-nwu-red transition-all cursor-pointer">
                    <Fingerprint size={48} className="text-gray-400" />
                </button>
                <div className="flex gap-4">
                    <button onClick={() => handleAction("[SYSTEM] Hard Reset Triggered.")} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-nwu-red hover:text-white transition-all"><RefreshCw size={20} /></button>
                </div>
            </div>
            <div className="bg-gray-950 p-8 rounded-[2.5rem] border border-white/10 font-mono text-sm space-y-3 h-[300px] overflow-hidden">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Live Terminal</span>
                    <Terminal size={14} className="text-gray-500" />
                </div>
                {logs.map((log, i) => (
                    <div key={i} className={cn("flex gap-4", log.includes("Scan") ? "text-blue-400" : log.includes("Reset") ? "text-red-400" : "text-gray-500")}>
                        <span className="opacity-30">[{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                        <span>{log}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function AboutPage() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

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

    const stats = [
        { label: "Lines of Code", value: "12k+", icon: Code, color: "text-blue-500" },
        { label: "Coffee Consumed", value: "Too Many", icon: Coffee, color: "text-nwu-gold" },
        { label: "Bugs Fixed", value: "99%", icon: Zap, color: "text-nwu-red" },
        { label: "Passion Level", value: "100%", icon: Heart, color: "text-pink-500" },
    ];

    if (!mounted) return null;

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 space-y-32">
                
                {/* Hero Section */}
                <div className="text-center relative py-12">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nwu-red/5 rounded-full blur-[100px] -z-10"></div>
                    <span className="inline-block py-1.5 px-4 rounded-full bg-nwu-red/10 text-nwu-red text-xs font-black tracking-widest uppercase border border-nwu-red/20 mb-6">
                        Anatomy of the Ecosystem • v2.0
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase italic mb-8">
                        The Core of <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-red via-orange-500 to-nwu-gold">
                            ClassTrack
                        </span>
                    </h1>
                </div>

                {/* Section 1: What is ClassTrack? (RESTORED) */}
                <section>
                    <SectionTitle title="What is ClassTrack?" />
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6">
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                                    The Future of University Attendance
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                                    ClassTrack is a <strong>Smart Classroom Attendance System</strong> designed for Northwestern University.
                                    It combines <strong>biometric fingerprint scanning</strong>, <strong>IoT device control</strong>,
                                    and <strong>real-time analytics</strong> to automate attendance tracking across the entire campus.
                                </p>
                                <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                                    No more paper-based roll calls or manual data entry. Students scan their fingerprint
                                    on an ESP32-powered kiosk, and their attendance is instantly logged, analyzed, and reported
                                    to both instructors and parents — all in real-time.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {["Biometric Auth", "IoT Control", "Real-time Analytics", "Auto Notifications", "QR Scanning", "Offline Kiosk Mode"].map(tag => (
                                        <span key={tag} className="px-3 py-1.5 bg-nwu-red/10 text-nwu-red text-[10px] font-black uppercase tracking-wider rounded-lg border border-nwu-red/20">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: "Roles", value: "4", sub: "Administrator, Dept Admin, Instructor, Student", icon: Users },
                                    { label: "Data Integrity", value: "100%", sub: "Fully scoped biometric isolation", icon: Shield },
                                    { label: "IoT Performance", value: "240MHz", sub: "ESP32-WROOM Dual Core Core", icon: Cpu },
                                    { label: "Notifications", value: "Instant", sub: "Auto-alerts for instructors", icon: Bell },
                                ].map((item, i) => (
                                    <div key={i} className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 text-center hover:scale-105 transition-transform group">
                                        <item.icon className="mx-auto mb-3 text-nwu-red opacity-40 group-hover:opacity-100 transition-opacity" size={24} />
                                        <div className="text-2xl font-black text-nwu-red mb-1 tracking-tighter">{item.value}</div>
                                        <div className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">{item.label}</div>
                                        <div className="text-[9px] text-gray-500 italic leading-tight">{item.sub}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 2: Technical Architecture */}
                <section>
                    <SectionTitle 
                        title="Technical Architecture" 
                        subtitle="A synchronized biometric ecosystem designed for high reliability and speed."
                    />
                    <AttendanceLifecycle />
                </section>

                {/* Section 3: Hardware Core */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="p-8 md:p-12 bg-gray-50 dark:bg-gray-900/40 rounded-[3rem] border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-4 mb-8">
                            <Cpu size={40} className="text-nwu-red" />
                            <h3 className="text-3xl font-black uppercase italic tracking-tighter text-gray-900 dark:text-white">The Hardware</h3>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-8">
                            Our kiosks are powerered by custom-integrated <strong>ESP32 Microcontrollers</strong> paired with <strong>AS608 Optical Fingerprint Modules</strong>. 
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Dual-core Xtensa® 32-bit LX6 processors",
                                "500 DPI optical scanning capability",
                                "AES-encrypted UART communication",
                                "Low-latency WiFi 802.11 b/g/n status sync"
                            ].map((spec, i) => (
                                <li key={i} className="flex items-center gap-3 text-gray-600 dark:text-gray-300 font-medium">
                                    <CheckCircle2 size={16} className="text-nwu-red" />
                                    {spec}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="p-8 md:p-12 bg-white dark:bg-gray-800 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl">
                        <SectionTitle title="The Lab" centered={false} subtitle="Simulated hardware interaction test-bench." />
                        <HardwareLab />
                    </div>
                </section>

                {/* Section 4: Team Section (REVERTED) */}
                <section>
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Meet the Dream Team</h2>
                        <div className="h-1.5 w-24 bg-nwu-gold mx-auto rounded-full mt-4"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {team.map((member, index) => (
                            <div
                                key={index}
                                className="group relative bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 shadow-xl border border-gray-100 dark:border-gray-700 hover:border-transparent transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
                            >
                                <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${member.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>

                                <div className="relative mx-auto w-40 h-40 mb-10">
                                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${member.color} blur-2xl opacity-10 group-hover:opacity-30 transition-opacity`}></div>
                                    <div className="relative w-full h-full bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-600 shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-700">
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-4xl text-gray-200 dark:text-gray-800 select-none opacity-30 group-hover:opacity-0 transition-opacity">
                                            {member.initials}
                                        </div>
                                        <Image
                                            src={member.image}
                                            alt={member.name}
                                            width={160}
                                            height={160}
                                            className="object-cover w-full h-full relative z-10"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.visibility = 'hidden';
                                            }}
                                        />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-900 p-2.5 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 z-20 transition-transform group-hover:rotate-12">
                                        <member.icon className="h-6 w-6 text-nwu-red" />
                                    </div>
                                </div>

                                <div className="text-center relative z-10">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight italic">{member.name}</h3>
                                    <p className={`text-xs font-black uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r ${member.color} mb-6 italic`}>
                                        {member.role}
                                    </p>
                                    <blockquote className="text-gray-500 dark:text-gray-400 italic font-medium leading-relaxed px-4">
                                        &quot;{member.quote}&quot;
                                    </blockquote>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Section 5: Stats Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-lg group">
                            <stat.icon className={cn("h-8 w-8 mx-auto mb-4 transition-transform group-hover:scale-110", stat.color)} />
                            <div className="text-4xl font-black text-gray-900 dark:text-white mb-1 tracking-tighter uppercase italic">{stat.value}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] italic">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Section 6: Future Milestones */}
                <section className="bg-black rounded-[4rem] p-12 md:p-24 overflow-hidden relative border border-white/5">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-nwu-red/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
                    <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
                        <div className="flex-1 space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-white text-[10px] font-black uppercase tracking-widest">
                                <Rocket size={14} className="text-nwu-gold" />
                                The Ongoing Evolution
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-tight">
                                Future <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-gold to-orange-500">Roadmap</span>
                            </h2>
                            <p className="text-gray-400 text-lg font-medium leading-relaxed italic">
                                We are constantly experimenting With new technologies to push the boundaries of classroom reliability.
                            </p>
                        </div>
                        <div className="flex-1 w-full grid grid-cols-1 gap-4">
                            {[
                                { title: "AI-Powered Analytics", status: "Researching", icon: BarChart3 },
                                { title: "Native Mobile App", status: "Planned", icon: MonitorSmartphone },
                                { title: "Face Recognition", status: "Exploring", icon: Eye },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <item.icon className="text-white opacity-40 group-hover:opacity-100 group-hover:text-nwu-gold" size={28} />
                                        <div>
                                            <h4 className="text-white font-black italic uppercase tracking-tight">{item.title}</h4>
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none">{item.status}</span>
                                        </div>
                                    </div>
                                    <CheckCircle2 size={16} className="text-gray-800" />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="text-center text-gray-400 dark:text-gray-600 text-[9px] font-black uppercase tracking-[1.5em] opacity-30 pt-20">
                    Produced by ClassTrack Team • Northwestern University
                </div>
            </div>
        </DashboardLayout>
    );
}
