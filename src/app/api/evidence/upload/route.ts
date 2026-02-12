import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const cookieStore = cookies();
        const profileId = cookieStore.get("sc_profile_id")?.value;

        if (!profileId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const studentId = formData.get("student_id") as string;
        const datesRaw = formData.get("dates") as string; // JSON array of date strings
        const description = formData.get("description") as string | null;

        if (!file || !studentId || !datesRaw) {
            return NextResponse.json({ error: "Missing file, student_id, or dates" }, { status: 400 });
        }

        const dates: string[] = JSON.parse(datesRaw);
        if (dates.length === 0) {
            return NextResponse.json({ error: "At least one date is required" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: "Only JPG, PNG, and PDF files are allowed" }, { status: 400 });
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "File size must be under 5MB" }, { status: 400 });
        }

        // Upload to Supabase Storage
        const ext = file.name.split(".").pop() || "bin";
        const filePath = `${studentId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

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

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("evidence-uploads")
            .getPublicUrl(filePath);

        // Create evidence document record
        const { data: doc, error: docError } = await supabase
            .from("evidence_documents")
            .insert({
                student_id: parseInt(studentId),
                file_url: urlData.publicUrl,
                file_name: file.name,
                file_type: file.type,
                description: description || null,
                status: "pending",
            })
            .select("id")
            .single();

        if (docError || !doc) {
            console.error("Evidence insert error:", docError);
            return NextResponse.json({ error: "Failed to save evidence record" }, { status: 500 });
        }

        // Create date link records
        const dateLinks = dates.map((d) => ({
            evidence_id: doc.id,
            absence_date: d,
        }));

        const { error: linkError } = await supabase
            .from("evidence_date_links")
            .insert(dateLinks);

        if (linkError) {
            console.error("Date link insert error:", linkError);
            return NextResponse.json({ error: "Failed to link dates" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            evidence_id: doc.id,
            dates_linked: dates.length,
        });
    } catch (err) {
        console.error("Evidence upload error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
