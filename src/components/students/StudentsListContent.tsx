import { getCachedStudents } from "@/lib/cache";
import { getActiveDepartments, type Department } from "@/lib/departments";
import { StudentsDirectory } from "./StudentsDirectory";
import { checkIsSuperAdmin, getProfileRole } from "@/lib/auth-utils";
import { cookies } from "next/headers";

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    department?: string;
    instructor_id?: string;
    instructor_name?: string;
    instructor_image_url?: string | null;
    fingerprint_slot_id?: number | null;
    image_url?: string | null;
    enrollments?: Array<{
        instructorId: string;
        instructorName: string;
        instructorImageUrl: string | null;
    }>;
}

export default async function StudentsListContent({
    query,
    isSuperAdmin: providedIsSuperAdmin,
    isAdmin: providedIsAdmin,
    profileId: providedProfileId,
    instructorId
}: {
    query: string;
    isSuperAdmin?: boolean;
    isAdmin?: boolean;
    profileId?: string;
    instructorId?: string;
}) {
    let internalIsSuperAdmin = providedIsSuperAdmin ?? false;
    let internalIsAdmin = providedIsAdmin ?? false;
    let internalProfileId = providedProfileId;

    // If not provided, fetch them robustly
    if (providedIsSuperAdmin === undefined) {
        try {
            internalIsSuperAdmin = await checkIsSuperAdmin();
            const role = await getProfileRole();
            internalIsAdmin = role === 'admin' && !internalIsSuperAdmin;
            const cookieStore = cookies();
            internalProfileId = cookieStore.get("sc_profile_id")?.value;
        } catch (e) {
            console.warn("[StudentsListContent] Auth fetch inhibited during build:", e);
        }
    }

    let students: Student[] = [];
    let departments: Department[] = [];
    let activeDepts: Department[] = [];
    let errorMsg = null;

    try {
        // Fetch ALL students (no dept/year filter) — filtering happens instantly on the client
        const [rawStudents, fetchedDepts] = await Promise.all([
            getCachedStudents(query),
            getActiveDepartments(internalProfileId)
        ]);

        departments = fetchedDepts;
        activeDepts = fetchedDepts;

        students = (rawStudents || []).map((s) => ({
            id: s.id,
            name: s.name || "",
            sin: s.sin || undefined,
            year_level: s.year_level || "",
            department: s.department || undefined,
            instructor_id: s.instructor_id,
            instructor_name: s.instructors?.name,
            instructor_image_url: s.instructors?.image_url,
            fingerprint_slot_id: s.fingerprint_slot_id,
            image_url: s.image_url,
            enrollments: s.enrollments?.map((e) => ({
                instructorId: e.classes?.instructors?.id,
                instructorName: e.classes?.instructors?.name,
                instructorImageUrl: e.classes?.instructors?.image_url
            })).filter((e) => e.instructorId)
        }));
    } catch (err: unknown) {
        console.error("Failed to load students:", err);
        errorMsg = "Failed to load students. Please try again later.";
    }

    // Determine Home College
    const colleges = activeDepts.map(d => d.college).filter(Boolean);
    const homeCollege = colleges.length > 0
        ? colleges.sort((a, b) => colleges.filter(v => v === a).length - colleges.filter(v => v === b).length).pop() || null
        : null;

    const homeDeptCodes = activeDepts.filter(d => d.college === homeCollege).map(d => d.code);

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
        <StudentsDirectory
            students={students}
            departments={departments}
            isSuperAdmin={internalIsSuperAdmin}
            isAdmin={internalIsAdmin}
            homeCollege={homeCollege}
            homeDeptCodes={homeDeptCodes}
            initialInstructorId={instructorId}
        />
    );
}
