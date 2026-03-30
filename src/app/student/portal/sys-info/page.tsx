"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import { 
    Cpu, 
    Loader2, 
    Activity,
    Box,
    Network,
    Fingerprint,
    Wifi,
    Server
} from "lucide-react";
import Image from "next/image";

// --- Crazy UI Components ---

const ParticleBackground = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            {[...Array(15)].map((_, i) => (
                <div
                    key={i}
                    className="absolute rounded-full bg-nwu-red/10 blur-2xl animate-float"
                    style={{
                        width: Math.random() * 250 + 50 + 'px',
                        height: Math.random() * 250 + 50 + 'px',
                        left: Math.random() * 100 + '%',
                        top: Math.random() * 100 + '%',
                        animationDelay: Math.random() * 5 + 's',
                        animationDuration: Math.random() * 8 + 8 + 's',
                    }}
                />
            ))}
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
        className="group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/20 dark:border-gray-800 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(151,13,11,0.15)] dark:hover:shadow-[0_20px_50px_rgba(255,255,255,0.03)] overflow-hidden"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon size={140} />
        </div>
        <div className="relative z-10">
            <div className="mb-6 h-12 w-12 rounded-2xl bg-nwu-red/10 flex items-center justify-center border border-nwu-red/20 group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6 text-nwu-red" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">{title}</h3>
            <ul className="space-y-2.5">
                {specs.slice(0, 4).map((spec: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight">
                        <div className="h-1 w-1 rounded-full bg-nwu-gold shrink-0" />
                        {spec}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

interface Student {
    name: string;
    sin: string;
    image_url?: string;
}

export default function SysInfoPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
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

    if (!mounted || loading || !student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
            </div>
        );
    }

    const team = [
        {
            name: "Arden Hero Damaso",
            role: "Full Stack Developer",
            initials: "AH",
            image: "/team/arden.png"
        },
        {
            name: "Clemen Jay Luis",
            role: "Frontend Developer",
            initials: "CJ",
            image: "/team/clemen.png"
        },
        {
            name: "Ace Donner Dane Asuncion",
            role: "Backend Developer",
            initials: "AD",
            image: "/team/ace.png"
        }
    ];

    const hardwareSpecs = [
        {
            title: "Biometric Core",
            icon: Fingerprint,
            specs: ["Optical AS608 Sensor", "UART Communication", "1:N Identification", "3.3V Logic Level"]
        },
        {
            title: "IoT Node",
            icon: Cpu,
            specs: ["ESP32 Dual-Core", "2.4GHz Wi-Fi", "Low-Latency Handshake", "WPA2 Enterprise Support"]
        },
        {
            title: "Cloud Engine",
            icon: Server,
            specs: ["PostgreSQL Supabase", "Auth + RLS Protection", "Edge Execution", "Live Persistence"]
        },
        {
            title: "Edge Resilience",
            icon: Wifi,
            specs: ["Offline Payload Queue", "Conflict Resolution", "Background Sync", "Status: [ ACTIVE ]"]
        }
    ];

    return (
        <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url}>
            <div className="relative max-w-6xl mx-auto space-y-32 py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <ParticleBackground />

                {/* Hero section */}
                <section className="text-center space-y-8 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nwu-gold/5 rounded-full blur-[100px] -z-10"></div>
                    <div className="space-y-4">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-nwu-red/10 border border-nwu-red/20 text-nwu-red text-[10px] font-black uppercase tracking-[0.4em]">
                            System Infrastructure v1.0
                        </span>
                        <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic leading-none">
                            Powered by <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-red to-nwu-gold">ClassTrack Edge</span>
                        </h1>
                    </div>
                </section>

                {/* Hardware Ecosystem */}
                <section className="space-y-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {hardwareSpecs.map((hardware, i) => (
                            <TechDetailCard key={i} {...hardware} delay={i * 100} />
                        ))}
                    </div>
                </section>

                {/* What is ClassTrack? - Redesigned */}
                <section className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-nwu-red/10 to-transparent blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-3xl rounded-[3rem] border border-gray-100 dark:border-gray-800 p-12 shadow-2xl overflow-hidden relative">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none italic">
                                    The Future of <br /><span className="text-nwu-red">Digital Attendance</span>
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed italic border-l-4 border-nwu-red pl-6">
                                    ClassTrack Student Portal is your high-speed access hub. Integrated with global scale biometrics and real-time cloud synchronization, we ensure your existence in class is never unrecorded.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {["Digital Excuse Letters", "Real-time Alerts", "QR Verification", "Offline Ready"].map(tag => (
                                        <span key={tag} className="px-3 py-1.5 bg-white dark:bg-gray-800 text-nwu-red rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-50 dark:border-red-900/30">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="relative h-[250px] flex items-center justify-center">
                                <div className="absolute inset-0 bg-nwu-red/5 rounded-full animate-ping opacity-10"></div>
                                <div className="relative z-10 p-8 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-2xl">
                                    <Box size={80} className="text-nwu-red" />
                                </div>
                                <Activity className="absolute top-0 right-10 text-nwu-red animate-pulse opacity-20" />
                                <Network className="absolute bottom-5 left-10 text-nwu-gold animate-bounce opacity-20" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Founding architects */}
                <section className="space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">The Dream Team</h2>
                        <div className="h-1.5 w-24 bg-nwu-gold mx-auto rounded-full"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {team.map((member, i) => (
                            <div key={i} className="group relative bg-white/60 dark:bg-gray-900/60 backdrop-blur-2xl p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800 text-center transition-all hover:-translate-y-2 hover:shadow-2xl">
                                <div className="relative mx-auto w-32 h-32 mb-8">
                                    <div className="absolute inset-0 bg-nwu-red/10 rounded-full animate-ping opacity-0 group-hover:opacity-100"></div>
                                    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-xl transition-transform duration-700 group-hover:scale-110 flex items-center justify-center">
                                        <Image
                                            src={member.image}
                                            alt={member.name}
                                            width={128}
                                            height={128}
                                            className="object-cover w-full h-full opacity-0 transition-opacity"
                                            onLoadingComplete={(img) => img.classList.remove('opacity-0')}
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-gray-200 dark:text-gray-800 select-none z-0">
                                            {member.initials}
                                        </span>
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">{member.name}</h3>
                                <p className="text-[10px] font-black text-nwu-red uppercase tracking-widest mt-2">{member.role}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer Section */}
                <div className="text-center pt-24 border-t border-gray-100 dark:border-gray-800 opacity-40">
                    <p className="text-[9px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-[1em] mb-8">AUTHENTIC PRODUCT OF</p>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-12 group transition-all duration-1000 cursor-default">
                        <div className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-[0.2em] flex items-center gap-4">
                        ICPEP.SE
                            <div className="h-3 w-3 rounded-full bg-nwu-red animate-pulse" />
                            NWU
                        </div>
                    </div>
                </div>
            </div>
        </StudentLayout>
    );
}
