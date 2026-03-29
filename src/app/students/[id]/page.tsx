import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { GraduationCap, Building2, Hash, Activity } from "lucide-react";
import { PhotoUpload } from "@/components/PhotoUpload";
import { getProfile, getProfileRole } from "@/lib/auth-utils";
import { StudentRecordsView } from "@/components/StudentRecordsView";

export const dynamic = "force-dynamic";

interface PageProps {
    params: { id: string };
}

export default async function StudentProfilePage({ params }: PageProps) {
    const role = await getProfileRole();
    const profile = await getProfile();
    const profileId = profile?.id;
    const adminSupabase = createAdminClient();

    if (!profileId) {
        redirect("/dashboard");
    }

    const idParam = params.id;
    const isNumeric = /^\d+$/.test(idParam);
    const studentIdInt = isNumeric ? parseInt(idParam) : null;

    // Fetch Student by ID or SIN
    let studentQuery = adminSupabase.from("students").select("*");
    if (studentIdInt !== null) {
        studentQuery = studentQuery.or(`id.eq.${studentIdInt},sin.eq.${idParam}`);
    } else {
        studentQuery = studentQuery.eq("sin", idParam);
    }

    const { data: student } = await studentQuery.single();

    if (!student) {
        notFound();
    }

    const breadcrumbItems = [
        { label: "Directory", href: "/students" },
        { label: student.name }
    ];

    return (
        <DashboardLayout>
            <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
                <Breadcrumb items={breadcrumbItems} />

                {/* Top Header Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 relative hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-nwu-red to-red-900 z-0"></div>
                    <div className="p-8 pt-12 relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <PhotoUpload
                            currentImageUrl={student.image_url}
                            recordId={String(student.id)}
                            tableName="students"
                            uploadPath={`profiles/students/${student.id}.jpg`}
                            size="lg"
                            readOnly={true}
                        />

                        <div className="flex-1">
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{student.name}</h1>
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                    <Hash className="h-3 w-3 mr-1.5" />
                                    {student.sin}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-900/30 text-nwu-red dark:text-red-400 border border-red-200 dark:border-red-800/20">
                                    <GraduationCap className="h-3 w-3 mr-1.5" />
                                    {student.year_level || "Unknown Year"}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/20">
                                    <Building2 className="h-3 w-3 mr-1.5" />
                                    {student.department || "General"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Content: Consolidated Attendance Records with Deep Linking */}
                <div className="mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center justify-between mb-8 overflow-hidden">
                            <h2 className="text-sm font-black uppercase text-gray-900 dark:text-white tracking-[0.2em] flex items-center gap-2">
                                <Activity className="h-4 w-4 text-nwu-red" />
                                Class-Specific Breakdown
                            </h2>
                            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700 mx-4"></div>
                        </div>
                        <StudentRecordsView
                            sin={student.sin}
                            studentId={String(student.id)}
                            viewerRole={role || undefined}
                            instructorId={profileId}
                        />
                    </div>
                </div>

                <div className="flex justify-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm">
                        ClassTrack Integrated Archive System v3.3
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
