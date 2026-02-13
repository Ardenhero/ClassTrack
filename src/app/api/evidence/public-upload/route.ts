import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_UPLOADS_PER_STUDENT = 5;

// Use service role to bypass RLS for public access
function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminClient();
        const formData = await request.formData();

        const sin = formData.get("sin") as string;
        const classId = formData.get("class_id") as string;
        const datesRaw = formData.get("dates") as string;
        const description = formData.get("description") as string | null;
        const files: File[] = [];

        // Collect all files from FormData (up to 5 slots: file0, file1, ..., file4)
        for (let i = 0; i < 5; i++) {
            const f = formData.get(`file${i}`);
            if (f && f instanceof File) {
                files.push(f);
            }
        }

        // Validate required fields
        if (!sin || !classId || !datesRaw) {
            return NextResponse.json({ error: "Missing SIN, class_id, or dates" }, { status: 400 });
        }

        if (files.length === 0) {
            return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
        }

        if (files.length > 5) {
            return NextResponse.json({ error: "Maximum 5 files per submission" }, { status: 400 });
        }

        const dates: string[] = JSON.parse(datesRaw);
        if (dates.length === 0) {
            return NextResponse.json({ error: "At least one date is required" }, { status: 400 });
        }

        // Look up student by SIN
        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("id, name, sin")
            .eq("sin", sin)
            .single();

        if (studentError || !student) {
            return NextResponse.json({ error: "Student not found. Please check your Student ID Number." }, { status: 404 });
        }

        // Check upload limit: count total uploads for this student
        const { count } = await supabase
            .from("evidence_documents")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id);

        const currentCount = count || 0;
        if (currentCount >= MAX_UPLOADS_PER_STUDENT) {
            return NextResponse.json({
                error: `Upload limit reached. You have already submitted ${currentCount}/${MAX_UPLOADS_PER_STUDENT} documents. Contact your instructor for assistance.`,
                remaining: 0,
            }, { status: 429 });
        }

        const remainingSlots = MAX_UPLOADS_PER_STUDENT - currentCount;
        if (files.length > remainingSlots) {
            return NextResponse.json({
                error: `You can only upload ${remainingSlots} more file(s). Current total: ${currentCount}/${MAX_UPLOADS_PER_STUDENT}.`,
                remaining: remainingSlots,
            }, { status: 400 });
        }

        // Validate all files
        const allowedTypes = ["image/jpeg", "image/png"];
        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                return NextResponse.json({ error: `Invalid file type: ${file.name}. Only JPG and PNG are allowed.` }, { status: 400 });
            }
            if (file.size > 5 * 1024 * 1024) {
                return NextResponse.json({ error: `File too large: ${file.name}. Maximum size is 5MB.` }, { status: 400 });
            }
        }

        // Upload all files and create evidence records
        const results = [];
        for (const file of files) {
            const ext = file.name.split(".").pop() || "jpg";
            const filePath = `public/${student.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            const arrayBuffer = await file.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from("evidence-uploads")
                .upload(filePath, arrayBuffer, {
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                return NextResponse.json({ error: "File upload failed: " + uploadError.message }, { status: 500 });
            }

            const { data: urlData } = supabase.storage
                .from("evidence-uploads")
                .getPublicUrl(filePath);

            // Create evidence document(s)
            const classIds = String(classId).split(','); // Handle multiple classes if passed as CSV
            const createdDocs = [];

            for (const cid of classIds) {
                const trimmedCid = cid.trim();
                if (!trimmedCid) continue;

                const { data: doc, error: docError } = await supabase
                    .from("evidence_documents")
                    .insert({
                        student_id: student.id,
                        class_id: trimmedCid, // Save the class ID to link to instructor
                        file_url: urlData.publicUrl,
                        file_name: file.name,
                        file_type: file.type,
                        description: description || `Excuse letter for class ${trimmedCid}`,
                        status: "pending",
                    })
                    .select("id")
                    .single();

                if (docError) {
                    console.error("Evidence creation error:", docError);
                    return NextResponse.json({ error: "Failed to save evidence record" }, { status: 500 });
                }

                createdDocs.push(doc);

                // Link dates to THIS evidence document
                if (dates.length > 0) {
                    const dateLinks = dates.map(d => ({
                        evidence_id: doc.id,
                        absence_date: d
                    }));

                    const { error: linkError } = await supabase
                        .from("evidence_date_links")
                        .insert(dateLinks);

                    if (linkError) {
                        console.error("Date link error:", linkError);
                        // Continue even if linking dates fails, distinct from evidence creation
                    }
                }
            }

            // The original `results.push` was for a single doc. Now we have multiple.
            // We'll push all created docs for this file into results.
            createdDocs.forEach(doc => results.push({ id: doc.id, file_name: file.name }));
        }

        return NextResponse.json({
            success: true,
            student_name: student.name,
            documents_uploaded: results.length,
            dates_linked: dates.length, // Use dates here
            remaining_uploads: MAX_UPLOADS_PER_STUDENT - currentCount - results.length,
        });
    } catch (err) {
        console.error("Public evidence upload error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// GET: Look up student by SIN (for the form to auto-populate)
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const sin = searchParams.get("sin");

        if (!sin) {
            return NextResponse.json({ error: "SIN is required" }, { status: 400 });
        }

        const { data: student } = await supabase
            .from("students")
            .select("id, name, sin, year_level")
            .eq("sin", sin)
            .single();

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Get classes this student is ENROLLED in (via enrollments table)
        // Explicitly join classes and instructors
        // NOTE: classes table uses 'name' not 'subject_name', and lacks 'section'
        const { data: enrollments, error: enrollmentError } = await supabase
            .from("enrollments")
            .select(`
                class_id,
                classes (
                    id,
                    name,
                    year_level,
                    instructor_id,
                    instructors (
                        id,
                        name,
                        role
                    )
                )
            `)
            .eq("student_id", student.id);

        if (enrollmentError) {
            console.error("Enrollment fetch error:", enrollmentError);
        }

        // define expected return type matches DB schema first
        interface EnrollmentDbResult {
            class_id: number;
            classes: {
                id: number;
                name: string; // valid column
                // section: string; // REMOVED: not in DB
                year_level: string;
                instructor_id: string | null;
                instructors: { id: string; name: string, role: string } | null;
            } | null;
        }

        let classesWithInstructor: {
            id: number;
            subject_name: string; // Frontend expects this
            section: string;      // Frontend expects this
            year_level: string;
            instructor_id: string;
            instructor_name: string;
            instructor_role: string;
        }[] = [];

        if (enrollments && enrollments.length > 0) {
            // Cast to formatted type safely
            const safeEnrollments = enrollments as unknown as EnrollmentDbResult[];

            // Build classes list from enrollment data
            classesWithInstructor = safeEnrollments.map((e) => {
                const c = e.classes;
                if (!c) return null;

                const instructor = c.instructors;

                return {
                    id: c.id,
                    subject_name: c.name, // Map 'name' to 'subject_name'
                    section: "",          // Default to empty as column missing
                    year_level: c.year_level,
                    instructor_id: instructor?.id || c.instructor_id || "",
                    instructor_name: instructor?.name || "Unknown Instructor",
                    instructor_role: instructor?.role || ""
                };
            }).filter((item): item is NonNullable<typeof item> => item !== null && !!item.id);
        }

        // REMOVED FALLBACK: Strict filtering as requested.
        // If no enrollments, student sees no classes.

        // Build distinct instructors list for the dropdown
        const instructorMap = new Map<string, string>();
        classesWithInstructor.forEach(cls => {
            // Filter: Must have ID, Name, AND NOT BE AN ADMIN
            if (cls.instructor_id && cls.instructor_name !== "Unknown Instructor") {
                if (cls.instructor_role === 'admin') return; // Skip System Admins

                if (!instructorMap.has(String(cls.instructor_id))) {
                    instructorMap.set(String(cls.instructor_id), String(cls.instructor_name));
                }
            }
        });
        const instructors = Array.from(instructorMap.entries()).map(([id, name]) => ({ id, name }));

        // Get upload count
        const { count } = await supabase
            .from("evidence_documents")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id);

        return NextResponse.json({
            student: {
                id: student.id,
                name: student.name,
                sin: student.sin,
                year_level: student.year_level,
            },
            classes: classesWithInstructor,
            instructors,
            uploads_used: count || 0,
            uploads_remaining: MAX_UPLOADS_PER_STUDENT - (count || 0),
        });
    } catch (err) {
        console.error("Student lookup error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
