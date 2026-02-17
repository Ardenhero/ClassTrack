import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveWebIdentity } from "@/lib/resolve-identity";

export const dynamic = 'force-dynamic';

/**
 * GET /api/fingerprint/slots
 * Returns all occupied fingerprint slot IDs, scoped to the caller's department.
 * Used by the ESP32 and web UI to determine which slots are taken.
 */
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // Resolve caller identity for department scoping
        const identity = await resolveWebIdentity();
        let scopedInstructorIds: string[] | null = null;

        if (identity?.department_id) {
            // Get all instructors in the same department
            const { data: deptInstructors } = await supabase
                .from('instructors')
                .select('id')
                .eq('department_id', identity.department_id);

            if (deptInstructors && deptInstructors.length > 0) {
                scopedInstructorIds = deptInstructors.map(i => i.id);
            }
        } else if (identity?.instructor_id) {
            // No department: scope to own instructor only
            scopedInstructorIds = [identity.instructor_id];
        }

        let query = supabase
            .from("students")
            .select("fingerprint_slot_id")
            .not("fingerprint_slot_id", "is", null);

        // Apply department scoping if we have identity
        if (scopedInstructorIds) {
            query = query.in("instructor_id", scopedInstructorIds);
        }
        // If no identity (e.g., ESP32 without auth), return all slots
        // ESP32 needs all slots to know which are occupied on the device

        const { data: students, error } = await query;
        if (error) throw error;

        const slots = students
            .map(s => s.fingerprint_slot_id)
            .filter(id => id && id > 0)
            .sort((a, b) => a - b);

        return NextResponse.json({
            success: true,
            count: slots.length,
            slots
        });

    } catch (err: unknown) {
        console.error("Fetch Slots API Error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
