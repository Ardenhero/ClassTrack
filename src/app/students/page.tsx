import DashboardLayout from "@/components/DashboardLayout";
import { AddStudentDialog } from "./AddStudentDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { StudentListItem } from "./StudentListItem";
import { YearGroup } from "@/components/YearGroup";
import { Suspense } from "react";
import { getCachedStudents } from "@/lib/cache";

export const dynamic = "force-dynamic";

// PURIFIED INTERFACE: Absolutely NO fingerprint_id
interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
}

export default async function StudentsPage({
    searchParams,
}: {
    searchParams?: { query?: string };
}) {
    const query = searchParams?.query || "";
    let students: Student[] = [];
    let errorMsg = null;

    try {
        const rawStudents = await getCachedStudents(query);

        // SANITIZATION: Map to clean Student interface - NO fingerprint_id passthrough
        students = (rawStudents || []).map((s) => ({
            id: s.id,
            name: s.name || "",
            sin: s.sin || undefined,
            year_level: s.year_level || "",
            // CRITICAL: Do NOT add fingerprint_id here - it's completely removed
        }));
    } catch (err: unknown) {
        console.error("Failed to load students:", err);
        errorMsg = "Failed to load students. Please try again later.";
    }

    const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    const groupedStudents = YEAR_LEVELS.reduce((acc, level) => {
        acc[level] = students.filter((s) => (s.year_level || "") === level);
        return acc;
    }, {} as Record<string, Student[]>);

    // Catch-all for students with non-standard year levels
    const otherStudents = students.filter((s) => !YEAR_LEVELS.includes(s.year_level || ""));
    if (otherStudents.length > 0) groupedStudents["Other"] = otherStudents;

    return (
        <DashboardLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Students Directory
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage enrolled students</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex-1 w-full md:w-64">
                        <Suspense fallback={<div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />}>
                            <GlobalSearch type="students" placeholder="Search students..." />
                        </Suspense>
                    </div>
                    <div className="flex-shrink-0">
                        <AddStudentDialog />
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-xl border border-red-100">
                    {errorMsg}
                </div>
            )}

            <div className="space-y-6">
                {Object.entries(groupedStudents).map(([level, items]) => (
                    items && items.length > 0 && (
                        <YearGroup key={level} title={level} count={items.length} itemLabel="students">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map((student) => (
                                    <StudentListItem
                                        key={student.id}
                                        student={{
                                            id: student.id,
                                            name: student.name,
                                            sin: student.sin,
                                            year_level: student.year_level || "Unknown"
                                        }}
                                    />
                                ))}
                            </div>
                        </YearGroup>
                    )
                ))}
            </div>

            {(!students || students.length === 0) && !errorMsg && (
                <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    No students found.
                </div>
            )}
        </DashboardLayout>
    );
}
