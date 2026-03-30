"use client";

import DashboardLayout from "../../components/DashboardLayout";
import {
    Code, Database, Rocket, Sparkles,
    Server, Globe, Cpu, Shield, Fingerprint, Wifi,
    BarChart3, Users, MonitorSmartphone, Activity, Box,
    CpuIcon, Layers, Network, Terminal
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

// --- Crazy UI Components ---

const ParticleBackground = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            {[...Array(20)].map((_, i) => (
                <div
                    key={i}
                    className="absolute rounded-full bg-nwu-red/20 blur-xl animate-float"
                    style={{
                        width: Math.random() * 300 + 50 + 'px',
                        height: Math.random() * 300 + 50 + 'px',
                        left: Math.random() * 100 + '%',
                        top: Math.random() * 100 + '%',
                        animationDelay: Math.random() * 5 + 's',
                        animationDuration: Math.random() * 10 + 10 + 's',
                    }}
                />
            ))}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 dark:opacity-10"></div>
        </div>
    );
};

interface TechCardProps {
    icon: any;
    title: string;
    specs: string[];
    delay: number;
}

const TechDetailCard = ({ icon: Icon, title, specs, delay }: TechCardProps) => (
    <div 
        className="group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/20 dark:border-gray-800 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(151,13,11,0.2)] dark:hover:shadow-[0_20px_50px_rgba(255,255,255,0.05)] overflow-hidden"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon size={160} />
        </div>
        <div className="relative z-10">
            <div className="mb-6 h-14 w-14 rounded-2xl bg-nwu-red/10 flex items-center justify-center border border-nwu-red/20 group-hover:scale-110 transition-transform">
                <Icon className="h-7 w-7 text-nwu-red" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tight">{title}</h3>
            <ul className="space-y-3">
                {specs.map((spec: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                        <div className="h-1 w-1 rounded-full bg-nwu-gold" />
                        {spec}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

export default function AboutPage() {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
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
            title: "AS608 Biometrics",
            icon: Fingerprint,
            specs: [
                "Optical Fingerprint Sensor",
                "High-speed 1:N Identification",
                "Serial UART Interface (57600bps)",
                "Security Level 1-5 Configurable",
                "3.3V - 6V DC Input Range"
            ]
        },
        {
            title: "ESP32 Core Controller",
            icon: Cpu,
            specs: [
                "Dual-core Xtensa® 32-bit LX6",
                "240MHz Max Frequency",
                "Integrated 802.11 b/g/n Wi-Fi",
                "WPA/WPA2/WPA2-Enterprise Auth",
                "Ultra-low Power Coprocessor"
            ]
        },
        {
            title: "Cloud Infrastructure",
            icon: Server,
            specs: [
                "Supabase PostgREST API",
                "Row Level Security (RLS)",
                "PostgreSQL JSONB Storage",
                "Edge Runtime Logic Execution",
                "WebSocket Sync (Offline Ready)"
            ]
        },
        {
            title: "Offline Kiosk Sync",
            icon: Wifi,
            specs: [
                "Local SQLite/Buffer Queue",
                "Automatic Network Polling",
                "Background Payload Shipping",
                "Conflict Resolution Logic",
                "Status: [ ACTIVE ]"
            ]
        }
    ];

    const systemInfo = [
        { label: "Platform", value: "Next.js 14 (App Router)", icon: Globe },
        { label: "Database", value: "Supabase (PostgreSQL)", icon: Database },
        { label: "Authentication", value: "Supabase Auth + RLS", icon: Shield },
        { label: "Hosting", value: "Vercel (Edge Network)", icon: Server },
    ];

    const futureFeatures = [
        {
            title: "AI-Powered Analytics",
            desc: "Machine learning models to predict at-risk students and detect attendance patterns.",
            icon: BarChart3,
            color: "text-blue-400",
            status: "Researching",
        },
        {
            title: "Mobile App (iOS & Android)",
            desc: "Native mobile application for real-time dashboard control and IoT management.",
            icon: MonitorSmartphone,
            color: "text-green-400",
            status: "Planned",
        },
        {
            title: "Face Recognition",
            desc: "Camera-based AI check-in as a touchless alternative to biometric fingerprinting.",
            icon: Users,
            color: "text-purple-400",
            status: "Exploring",
        },
    ];

    if (!mounted) return null;

    return (
        <DashboardLayout>
            <div className="relative min-h-screen max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
                <ParticleBackground />

                {/* Hero Section */}
                <div className="text-center mb-32 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-nwu-red/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
                    <span className="inline-block py-2 px-6 rounded-full bg-nwu-red/10 text-nwu-red text-xs font-black tracking-[0.3em] mb-8 uppercase border border-nwu-red/20 shadow-[0_0_20px_rgba(151,13,11,0.1)]">
                        Technical Infrastructure • v1.0
                    </span>
                    <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white mb-8 tracking-tighter leading-none italic uppercase">
                        Digital <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-red via-orange-500 to-nwu-gold animate-gradient-x underline decoration-red-500 decoration-8">
                            Excellence
                        </span>
                    </h1>
                    <p className="max-w-3xl mx-auto text-xl text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                        Engineering a smarter campus through hardware-software synergy and biometric integrity.
                    </p>
                </div>

                {/* Hardware & Systems Detail */}
                <div className="mb-32">
                    <div className="flex flex-col items-center mb-16">
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter italic">Hardware Ecosystem</h2>
                        <div className="h-2 w-32 bg-gradient-to-r from-nwu-red to-nwu-gold rounded-full shadow-[0_0_15px_rgba(151,13,11,0.3)]"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                        {hardwareSpecs.map((hardware, i) => (
                            <TechDetailCard key={i} {...hardware} delay={i * 100} />
                        ))}
                    </div>
                </div>

                {/* Interactive Centerpiece */}
                <div className="mb-32 relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-nwu-red/20 to-nwu-gold/20 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="relative bg-white/60 dark:bg-gray-900/60 backdrop-blur-3xl rounded-[3rem] p-12 border border-white/20 dark:border-gray-800 shadow-2xl overflow-hidden">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <h3 className="text-3xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter leading-none">
                                        Active <br /><span className="text-nwu-red drop-shadow-sm">Synchronized Architecture</span>
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed italic border-l-4 border-nwu-red pl-6">
                                        ClassTrack leverages the power of ESP32 edge computing to maintain zero-downtime attendance logging. Our Offline Sync protocol ensures that not a single data point is lost during network blackouts.
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: "IOT KIOSKS", val: "ESP32", icon: CpuIcon },
                                        { label: "SYNC STATE", val: "LIVE", icon: Activity },
                                        { label: "SECURITY", val: "AES-256", icon: Shield }
                                    ].map((badge, i) => (
                                        <div key={i} className="flex flex-col items-center p-4 bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <badge.icon className="h-6 w-6 text-nwu-red mb-2" />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{badge.label}</span>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white mt-1">{badge.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="relative h-[300px] flex items-center justify-center">
                                <div className="absolute inset-0 bg-nwu-red/5 rounded-full animate-ping opacity-20"></div>
                                <div className="absolute inset-16 bg-nwu-gold/10 rounded-full animate-pulse"></div>
                                <div className="relative z-10 p-10 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-[0_0_50px_rgba(151,13,11,0.2)]">
                                    <Box size={100} className="text-nwu-red" />
                                </div>
                                {/* Tech Bits */}
                                <Terminal className="absolute top-0 right-10 text-nwu-red/30 animate-bounce" />
                                <Network className="absolute bottom-10 left-10 text-nwu-gold/30 animate-pulse" />
                                <Layers className="absolute top-20 left-0 text-gray-400/20" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Infrastructure Tags */}
                <div className="mb-32 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {systemInfo.map((info, i) => (
                        <div key={i} className="group relative bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 transition-all hover:bg-white dark:hover:bg-gray-800 overflow-hidden">
                            <div className="absolute inset-0 bg-nwu-red/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <info.icon className="h-6 w-6 text-nwu-red mb-3 group-hover:scale-125 transition-transform duration-500" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{info.label}</span>
                                <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{info.value}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Team Section - Refined */}
                <div className="mb-32">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter italic">Founding Architects</h2>
                        <div className="h-2 w-32 bg-nwu-gold mx-auto rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {team.map((member, index) => (
                            <div
                                key={index}
                                className="group relative bg-white dark:bg-gray-800 rounded-[3rem] p-10 transition-all duration-500 hover:-translate-y-4 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700"
                            >
                                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${member.color} rounded-t-[3rem] opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                
                                <div className="relative mx-auto w-40 h-40 mb-10">
                                    <div className="absolute inset-0 rounded-full bg-nwu-red/10 animate-ping group-hover:animate-none opacity-0 group-hover:opacity-100"></div>
                                    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border-4 border-white dark:border-gray-600 shadow-2xl transition-transform duration-700 group-hover:scale-110">
                                        <Image
                                            src={member.image}
                                            alt={member.name}
                                            width={160}
                                            height={160}
                                            className="object-cover w-full h-full opacity-0 transition-opacity duration-1000 delay-500"
                                            onLoadingComplete={(image) => image.classList.remove('opacity-0')}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-4xl text-gray-200 dark:text-gray-800 select-none">
                                            {member.initials}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter leading-none italic">{member.name}</h3>
                                    <p className={`text-xs font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r ${member.color} mb-6`}>
                                        {member.role}
                                    </p>
                                    <p className="text-gray-500 dark:text-gray-400 italic font-medium leading-relaxed px-4">
                                        &quot;{member.quote}&quot;
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Roadmap - Grid Style */}
                <div className="relative bg-gray-950 rounded-[4rem] p-12 md:p-24 overflow-hidden border border-white/5">
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
                            <p className="text-gray-400 text-lg leading-relaxed font-medium italic underline decoration-nwu-gold/30">
                                ClassTrack is not a static product; it is a living ecosystem. We continue to research the cutting edge of biometric scalability.
                            </p>
                        </div>
                        <div className="flex-1 grid grid-cols-1 gap-6 w-full lg:w-auto">
                            {futureFeatures.map((feature, i) => (
                                <div key={i} className="group flex items-center gap-6 p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] transition-all hover:bg-white/10 hover:border-nwu-red/30">
                                    <div className={`h-16 w-16 rounded-2xl bg-gray-900 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform ${feature.color}`}>
                                        <feature.icon size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-white font-black uppercase tracking-tight italic">{feature.title}</h3>
                                            <span className="text-[8px] font-black text-nwu-gold uppercase tracking-[0.2em] border border-nwu-gold/30 px-2 py-1 rounded-md">{feature.status}</span>
                                        </div>
                                        <p className="text-gray-400 text-sm leading-relaxed font-medium">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-32 text-center text-gray-500 dark:text-gray-600 text-[10px] font-black uppercase tracking-[1em] opacity-30">
                    Proprietary of ClassTrack Team • Northwestern University • Building the Future
                </div>
            </div>
        </DashboardLayout>
    );
}
