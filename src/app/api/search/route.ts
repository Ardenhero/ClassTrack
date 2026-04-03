import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getProfile, getProfileRole, checkIsSuperAdmin } from "@/lib/auth-utils";
import { getCachedStudents } from "@/lib/cache";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const type = searchParams.get("type") || "all"; // 'all', 'classes', 'students'

    if (!query) {
        return NextResponse.json({ classes: [], students: [] });
    }

    const supabase = createClient();
    const [profile, role, isSuperAdmin] = await Promise.all([
        getProfile(),
        getProfileRole(),
        checkIsSuperAdmin()
    ]);

    if (!profile) {
        return NextResponse.json({ classes: [], students: [] });
    }

    // Search Classes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let classes: any[] = [];
    if (type === "all" || type === "classes") {
        let classQuery = supabase.from("classes").select("id, name");

        // Role-based scoping for classes
        if (!isSuperAdmin) {
            if (role === 'admin') {
                // Dept Admin: See classes in their department OR linked via their instructor group
                const { data: adminProfile } = await supabase
                    .from('instructors')
                    .select('auth_user_id, departments(name)')
                    .eq('id', profile.id)
                    .single();

                // @ts-expect-error - Join type
                const adminDeptName = adminProfile?.departments?.name as string | undefined;

                let accountInstructorIds: string[] = [];
                if (adminProfile?.auth_user_id) {
                    const { data: accountInstructors } = await supabase
                        .from('instructors')
                        .select('id')
                        .or(`auth_user_id.eq."${adminProfile.auth_user_id}",owner_id.eq."${adminProfile.auth_user_id}"`);
                    accountInstructorIds = (accountInstructors as { id: string }[] | null)?.map(i => i.id) || [];
                }

                if (adminDeptName && accountInstructorIds.length > 0) {
                    classQuery = classQuery.or(`department.eq."${adminDeptName}",instructor_id.in.(${accountInstructorIds.join(',')})`);
                } else if (adminDeptName) {
                    classQuery = classQuery.eq('department', adminDeptName);
                } else if (accountInstructorIds.length > 0) {
                    classQuery = classQuery.in('instructor_id', accountInstructorIds);
                }
            } else {
                // Instructor: Only their classes
                classQuery = classQuery.eq("instructor_id", profile.id);
            }
        }

        const { data } = await classQuery
            .ilike("name", `%${query}%`)
            .limit(5);
        classes = data || [];
    }

    // Search Students using centralized cache logic (already handles role scoping)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let students: any[] = [];
    if (type === "all" || type === "students") {
        const results = await getCachedStudents(query);
        students = results.slice(0, 5);
    }

    return NextResponse.json({
        classes,
        students
    });
}
