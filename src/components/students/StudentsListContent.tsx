import { StudentGrid } from "@/app/students/StudentGrid";
import { YearGroup } from "@/components/YearGroup";
import { getCachedStudents } from "@/lib/cache";

// PURIFIED INTERFACE: Allowing fingerprint_slot_id for status display
interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    fingerprint_slot_id?: number | null;
}

export default async function StudentsListContent({
    query,
    isSuperAdmin
}: {
    query: string;
    isSuperAdmin: boolean;
}) {
    let students: Student[] = [];
    let errorMsg = null;

    try {
        const rawStudents = await getCachedStudents(query);

        // SANITIZATION: Map to clean Student interface
        students = (rawStudents || []).map((s) => ({
            id: s.id,
            name: s.name || "",
            sin: s.sin || undefined,
            year_level: s.year_level || "",
            fingerprint_slot_id: s.fingerprint_slot_id // Pass through for UI status
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

    if (errorMsg) {
        return (
            <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-xl border border-red-100">
                {errorMsg}
            </div>
        );
    }

    if (!students || students.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                No students found.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {Object.entries(groupedStudents).map(([level, items]) => (
                items && items.length > 0 && (
                    <YearGroup key={level} title={level} count={items.length} itemLabel="students">
                        <StudentGrid students={items} isSuperAdmin={isSuperAdmin} />
                    </YearGroup>
                )
            ))}
        </div>
    );
}
