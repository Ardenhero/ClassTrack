"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession, getLatestStudentRecord } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import { FileText, Loader2, Info, ShieldCheck } from "lucide-react";
import { SubmitEvidenceContent } from "@/components/SubmitEvidenceContent";

interface Student {
    name: string;
    sin: string;
    image_url?: string;
    status?: string;
}

export default function ExcusePage() {
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
            
            // Sync live status
            const latest = await getLatestStudentRecord();
            if (latest.student) {
                setStudent(latest.student);
            } else {
                setStudent(session);
            }
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

    const isRestricted = student.status && ['graduated', 'dropped', 'transferred'].includes(student.status.toLowerCase());

    return (
        <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url} status={student.status?.toUpperCase()}>
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <FileText className="h-8 w-8 text-nwu-red" />
                        Excuse Letter
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Submit justifications for missed classes with supporting documentation.
                    </p>
                </div>

                {isRestricted ? (
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-red-100 dark:border-red-900/30 p-12 shadow-2xl text-center space-y-6">
                        <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto shadow-xl">
                            <ShieldCheck className="h-10 w-10 text-nwu-red" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Access Restricted</h2>
                            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
                                Excuse letter submission is disabled because your account status is currently set to 
                                <span className="text-nwu-red font-bold uppercase mx-1">{(student.status || "UNKNOWN").toUpperCase()}</span>.
                                Please contact the Registrar for assistance.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push("/student/portal/dashboard")}
                            className="px-10 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-black hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm"
                        >
                            RETURN TO DASHBOARD
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Form Area */}
                        <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-2 shadow-2xl overflow-hidden">
                                <div className="p-8">
                                    <SubmitEvidenceContent sin={student.sin} />
                                </div>
                            </div>
                        </div>

                        {/* Sidebar / Instructions */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 shadow-xl">
                                <div className="flex items-center gap-3 mb-4 text-nwu-red">
                                    <Info className="h-6 w-6" />
                                    <h3 className="font-bold uppercase tracking-widest text-xs">Guidelines</h3>
                                </div>
                                <ul className="space-y-4">
                                    <li className="flex gap-3 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="h-1.5 w-1.5 rounded-full bg-nwu-red mt-2 shrink-0" />
                                        <p>Ensure your reason matches the official excuse classifications.</p>
                                    </li>
                                    <li className="flex gap-3 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="h-1.5 w-1.5 rounded-full bg-nwu-red mt-2 shrink-0" />
                                        <p>Upload clear, readable images of medical certificates or official papers.</p>
                                    </li>
                                    <li className="flex gap-3 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="h-1.5 w-1.5 rounded-full bg-nwu-red mt-2 shrink-0" />
                                        <p>Submission does not guarantee approval. Check status in Records.</p>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-nwu-red rounded-3xl p-6 text-white shadow-xl shadow-red-200 dark:shadow-none">
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldCheck className="h-6 w-6" />
                                    <h3 className="font-bold uppercase tracking-widest text-xs">Formal Ethics</h3>
                                </div>
                                <p className="text-xs text-red-50 font-medium leading-relaxed italic">
                                    &quot;Providing false information or forged documents is a serious offense and may lead to disciplinary action as per university policy.&quot;
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </StudentLayout>
    );
}
