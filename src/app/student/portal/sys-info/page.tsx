"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import { 
    Cpu, 
    Database, 
    Loader2, 
    Globe, 
    Code2,
    Users,
    Zap,
    Bell,
    Heart,
    Coffee,
    Sparkles,
    Layers,
    ShieldCheck,
    Code,
    QrCode
} from "lucide-react";
import Image from "next/image";

interface Student {
    name: string;
    sin: string;
    image_url?: string;
}

export default function SysInfoPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const session = await getStudentSession();
            if (!session) {
                router.push("/student/portal");
                return;
            }
            setStudent(session);
            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading || !student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
            </div>
        );
    }

    const FEATURES = [
        { title: "ROLES", desc: "Administrator, Instructor, Student", icon: Users, color: "text-red-500" },
        { title: "BIOMETRIC", desc: "Secure ESP32 Fingerprint Kiosk", icon: Zap, color: "text-orange-500" },
        { title: "QR SCAN", desc: "Instant mobile session verification", icon: QrCode, color: "text-blue-500" },
        { title: "HISTORY", desc: "Real-time attendance analytics", icon: Database, color: "text-red-500" },
    ];

    const TEAM = [
        {
            name: "Arden Hero Damaso",
            role: "FULL STACK DEVELOPER",
            quote: '"Building the future, one line of code at a time."',
            initials: "AH",
            color: "border-red-500/30",
            icon: Code,
            image: "/team/arden.png"
        },
        {
            name: "Clemen Jay Luis",
            role: "FRONTEND DEVELOPER",
            quote: '"Designing experiences that delight and inspire."',
            initials: "CJ",
            color: "border-blue-500/30",
            icon: Sparkles,
            image: "/team/clemen.png"
        },
        {
            name: "Ace Donner Dane Asuncion",
            role: "BACKEND DEVELOPER",
            quote: '"Ensuring stability and performance at scale."',
            initials: "AA",
            color: "border-purple-500/30",
            icon: Database,
            image: "/team/ace.png"
        }
    ];

    const STATS = [
        { label: "10k+", value: "LINES OF CODE", icon: Code2, color: "text-blue-500" },
        { label: "∞", value: "COFFEE CONSUMED", icon: Coffee, color: "text-yellow-500" },
        { label: "99%", value: "BUGS CRUSHED", icon: Zap, color: "text-red-500" },
        { label: "100%", value: "PASSION LEVEL", icon: Heart, color: "text-pink-500" },
    ];

    const SYSTEM_SPECS = [
        { label: "PLATFORM", value: "Next.js 14 (App Router)", icon: Globe },
        { label: "DATABASE", value: "Supabase (PostgreSQL)", icon: Database },
        { label: "AUTHENTICATION", value: "Supabase Auth + RLS", icon: ShieldCheck },
        { label: "IOT INTEGRATION", value: "ESP32 + Tuya Cloud", icon: Cpu },
    ];

    return (
        <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url}>
            <div className="max-w-6xl mx-auto space-y-24 py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                
                {/* Section 1: What is ClassTrack? */}
                <section className="space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            What is ClassTrack?
                        </h2>
                        <div className="h-1.5 w-24 bg-nwu-gold mx-auto rounded-full" />
                    </div>

                    <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 md:p-12 shadow-2xl flex flex-col lg:flex-row gap-12">
                        <div className="flex-1 space-y-8">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tight">Empowering Students with <br /><span className="text-nwu-red">Digital Attendance Tracking</span></h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-lg font-medium">
                                ClassTrack Student Portal is your personal hub for managing your academic attendance records at Northwestern University. 
                                It provides a transparent, <span className="text-nwu-red font-bold">real-time view</span> of your attendance history across all enrolled subjects.
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                Easily monitor your attendance percentage, submit digitized excuse letters for medical or personal absences, and receive instant updates. 
                                Integrated with biometric fingerprint sensors campus-wide, ClassTrack ensures your records are accurate, secure, and always accessible.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {["Attendance Monitoring", "Digital Excuse Letters", "Real-time Alerts", "Account Security", "QR Verification", "Historical Records"].map(tag => (
                                    <span key={tag} className="px-5 py-2.5 bg-white dark:bg-gray-800 text-nwu-red rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-50 dark:border-red-900/30 shadow-sm">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 lg:w-[450px]">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="bg-white/80 dark:bg-gray-800/80 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center gap-4 transition-all hover:scale-105 hover:bg-white dark:hover:bg-gray-800 hover:shadow-xl">
                                    <div className={`h-12 w-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center border border-gray-100 dark:border-gray-700`}>
                                        <f.icon className={`h-6 w-6 ${f.color}`} />
                                    </div>
                                    <div>
                                        <p className={`text-xl font-black ${f.color} tracking-tight uppercase`}>{f.title}</p>
                                        <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight mt-1">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Section 2: System Information */}
                <section className="space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            Portal Infrastructure
                        </h2>
                        <div className="h-1.5 w-24 bg-nwu-gold mx-auto rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {SYSTEM_SPECS.map((spec, i) => (
                            <div key={i} className="group bg-white/40 dark:bg-gray-900/40 backdrop-blur-md p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 transition-all hover:bg-white dark:hover:bg-gray-900 hover:shadow-2xl">
                                <spec.icon className="h-10 w-10 text-nwu-red mb-8 transition-transform group-hover:scale-110" />
                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-2">{spec.label}</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase">{spec.value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Section 3: Meet the Dream Team */}
                <section className="space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            Meet the Dream Team
                        </h2>
                        <div className="h-1.5 w-24 bg-nwu-gold mx-auto rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {TEAM.map((member, i) => (
                            <div key={i} className={`group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-10 rounded-[3rem] border-2 ${member.color} shadow-2xl transition-all duration-700 hover:-translate-y-4 text-center overflow-hidden flex flex-col items-center`}>
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <member.icon className="h-24 w-24" />
                                </div>
                                <div className="relative mb-10 pt-4">
                                    <div className="h-40 w-40 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 p-1.5 shadow-2xl relative z-10 mx-auto">
                                        <div className="h-full w-full rounded-full overflow-hidden bg-white dark:bg-gray-900 flex items-center justify-center relative">
                                            {/* Initial Fallback if Image is null or breaks */}
                                            <span className="text-4xl font-black text-gray-200 dark:text-gray-800 absolute z-0 select-none">
                                                {member.initials}
                                            </span>
                                            <Image 
                                                src={member.image} 
                                                alt={member.name} 
                                                width={160}
                                                height={160}
                                                className="h-full w-full object-cover transition-all duration-700 scale-110 group-hover:scale-100 relative z-10" 
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 h-12 w-12 bg-nwu-red rounded-2xl border-4 border-white dark:border-gray-900 flex items-center justify-center z-20 shadow-xl transition-transform group-hover:rotate-12">
                                        <member.icon className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                                <div className="space-y-4 z-10">
                                    <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{member.name}</h4>
                                    <p className="text-[10px] font-black text-nwu-red dark:text-red-400 uppercase tracking-[0.3em] leading-relaxed">
                                        {member.role}
                                    </p>
                                    <div className="h-0.5 w-10 bg-gray-100 dark:bg-gray-800 mx-auto rounded-full transition-all group-hover:w-20 group-hover:bg-nwu-gold" />
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 italic leading-relaxed px-4">
                                        {member.quote}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
                        {STATS.map((stat, i) => (
                            <div key={i} className="flex flex-col items-center gap-4 p-10 bg-white/20 dark:bg-gray-900/20 backdrop-blur-sm rounded-[2.5rem] border border-gray-100/50 dark:border-gray-800/50 transition-all hover:bg-white/40 dark:hover:bg-gray-900/40">
                                <div className={`h-14 w-14 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-lg`}>
                                    <stat.icon className={`h-7 w-7 ${stat.color}`} />
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">{stat.label}</p>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer Section */}
                <div className="text-center pt-24 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-[1em] mb-8">AUTHENTIC PRODUCT OF</p>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-12 group transition-all duration-1000 cursor-default">
                        <div className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-[0.2em] flex items-center gap-4">
                        ICPEP.SE
                            <div className="h-3 w-3 rounded-full bg-nwu-red animate-pulse" />
                            NWU
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mt-12">
                        © 2026 CLASSTRACK ECOSYSTEM • BUILDING THE FUTURE
                    </p>
                </div>
            </div>
        </StudentLayout>
    );
}
