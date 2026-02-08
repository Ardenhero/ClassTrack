"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Code, Database, Zap, Heart, Rocket, Coffee, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function AboutPage() {
    const team = [
        {
            name: "Arden Hero Damaso",
            role: "Lead Developer & Architect",
            initials: "AH",
            image: "/team/arden.png",
            color: "from-nwu-red to-orange-500",
            icon: Code,
            quote: "Building the future, one line of code at a time.",
        },
        {
            name: "Clemen Jay Luis",
            role: "Frontend Specialist & UX Designer",
            initials: "CJ",
            image: "/team/clemen.png",
            color: "from-blue-500 to-cyan-400",
            icon: Sparkles,
            quote: "Designing experiences that delight and inspire.",
        },
        {
            name: "Ace Donner Dane Asuncion",
            role: "Backend Engineer & Data Analyst",
            initials: "AD",
            image: "/team/ace.png",
            color: "from-purple-500 to-pink-500",
            icon: Database,
            quote: "Ensuring stability and performance at scale.",
        },
    ];

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 overflow-hidden">
                {/* Hero Section */}
                <div className="text-center mb-24 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nwu-red/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>
                    <span className="inline-block py-1.5 px-4 rounded-full bg-nwu-red/10 text-nwu-red text-xs font-extrabold tracking-widest mb-6 uppercase border border-nwu-red/20 shadow-sm">
                        Attendance System v1.0 • Student Edition
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white mb-8 tracking-tight leading-tight">
                        We Build <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-nwu-red via-orange-500 to-yellow-500 animate-gradient-x">
                            Digital Excellence
                        </span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-400 leading-relaxed font-light">
                        A collaborative masterpiece by three passionate student developers from the Institute of Computer Engineers of the Philippines.
                    </p>
                </div>

                {/* Team Section (The "Wild" Part) */}
                <div className="mb-32">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Meet the Dream Team</h2>
                        <div className="h-1 w-24 bg-nwu-gold mx-auto rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                        {team.map((member, index) => (
                            <div
                                key={index}
                                className="group relative bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 hover:border-transparent transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
                            >
                                {/* Hover Gradient Border Effect */}
                                <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${member.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>

                                {/* Avatar */}
                                <div className="relative mx-auto w-32 h-32 mb-8">
                                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${member.color} blur-2xl opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                                    <div className="relative w-full h-full bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-600 shadow-lg overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                        <Image
                                            src={member.image}
                                            alt={member.name}
                                            width={128}
                                            height={128}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-900 p-2 rounded-full shadow-md border border-gray-100 dark:border-gray-700">
                                        <member.icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="text-center relative z-10">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{member.name}</h3>
                                    <p className={`text-sm font-semibold uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r ${member.color} mb-6`}>
                                        {member.role}
                                    </p>
                                    <blockquote className="text-gray-500 dark:text-gray-400 italic font-medium leading-relaxed">
                                        &quot;{member.quote}&quot;
                                    </blockquote>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats / Impact Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-32">
                    {[
                        { label: "Lines of Code", value: "10k+", icon: Code, color: "text-blue-500" },
                        { label: "Coffee Consumed", value: "∞", icon: Coffee, color: "text-nwu-gold" },
                        { label: "Bugs Crushed", value: "99%", icon: Zap, color: "text-nwu-red" },
                        { label: "Passion Level", value: "100%", icon: Heart, color: "text-pink-500" },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-100 dark:border-gray-700 text-center hover:bg-white dark:hover:bg-gray-800 transition-colors">
                            <stat.icon className={`h-8 w-8 mx-auto mb-3 ${stat.color}`} />
                            <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stat.value}</div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Future Roadmap */}
                <div className="relative bg-black rounded-[3rem] p-8 md:p-16 overflow-hidden text-center">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/80 z-0"></div>
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/30 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/30 rounded-full blur-[100px] animate-pulse delay-1000"></div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold tracking-wide mb-8 backdrop-blur-md">
                            <Rocket className="h-4 w-4 text-yellow-400" />
                            <span>Coming Soon</span>
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white mb-8">
                            The Future of <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Attendance System</span>
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-12">
                            We aren&apos;t stopping here. We&apos;re already cooking up features like AI-powered analytics, mobile app integration, and real-time biometric scanning.
                        </p>

                        <div className="flex flex-wrap justify-center gap-4">
                            <Link href="/" className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:scale-105 transition-transform shadow-xl shadow-white/20">
                                Go to Dashboard
                            </Link>
                            <div className="px-8 py-4 bg-white/10 text-white border border-white/10 rounded-xl font-bold backdrop-blur-md cursor-not-allowed opacity-70">
                                Join Beta (Soon)
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-center text-gray-400 text-sm font-medium">
                    Made with ❤️ by the <span className="text-nwu-gold">Attendance System Team</span> • {new Date().getFullYear()}
                </div>
            </div>
        </DashboardLayout>
    );
}
export const dynamic = 'force-dynamic';
