import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Auto-Absent Email Notification (Cron Route)
 * 
 * Sends ONE email PER CLASS that a student was absent from.
 * e.g., if John missed Math and Science, his guardian gets 2 separate emails.
 * 
 * Called daily by Vercel Cron at 7:00 AM PHT.
 * Uses Resend API for email delivery. Falls back to dry-run if not configured.
 * 
 * Environment Variables Required:
 * - RESEND_API_KEY: Your Resend API key
 * - CRON_SECRET: A secret to protect this endpoint from unauthorized access
 */

export async function GET(request: Request) {
    // Protect the cron endpoint
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Find all students who were absent yesterday — one row per class
    const { data: absentLogs, error } = await supabase
        .from("attendance_logs")
        .select(`
            id,
            student_id,
            students!inner(full_name, sin, guardian_email, guardian_name),
            classes!inner(name)
        `)
        .eq("status", "Absent")
        .gte("created_at", `${yesterdayStr}T00:00:00`)
        .lte("created_at", `${yesterdayStr}T23:59:59`);

    if (error) {
        console.error("Failed to fetch absent logs:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!absentLogs || absentLogs.length === 0) {
        return NextResponse.json({ sent: 0, message: "No absences found for yesterday" });
    }

    let sent = 0;
    const failed: string[] = [];
    const RESEND_KEY = process.env.RESEND_API_KEY;

    // Send one email per absence (per class)
    for (const log of absentLogs) {
        const student = log.students as unknown as {
            full_name: string;
            sin: string;
            guardian_email: string | null;
            guardian_name: string | null;
        };
        const cls = log.classes as unknown as { name: string };

        // Skip if no guardian email set (it's optional)
        if (!student?.guardian_email) continue;

        const guardianName = student.guardian_name || "Parent/Guardian";

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #8B0000; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">ClassTrack — Absence Notification</h1>
                    <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Northwestern University Smart Classroom System</p>
                </div>
                <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
                    <p style="font-size: 15px; color: #333;">Dear ${guardianName},</p>
                    <p style="font-size: 14px; color: #555; line-height: 1.6;">
                        This is an automated notification from the ClassTrack Attendance System. 
                        Your child/ward, <strong>${student.full_name}</strong> (SIN: ${student.sin}), 
                        was recorded as <strong style="color: #dc2626;">Absent</strong> on 
                        <strong>${yesterdayStr}</strong> in:
                    </p>
                    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                        <p style="font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 0;">${cls.name}</p>
                    </div>
                    <p style="font-size: 13px; color: #777; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                        If this absence was excused, your child can submit an excuse letter through the Student Portal. 
                        If you believe this is an error, please contact the class instructor.
                    </p>
                    <p style="font-size: 11px; color: #999; margin-top: 16px;">
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            </div>
        `;

        if (RESEND_KEY) {
            try {
                const res = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${RESEND_KEY}`,
                    },
                    body: JSON.stringify({
                        from: "ClassTrack <noreply@classtrack.app>",
                        to: [student.guardian_email],
                        subject: `Absence Alert: ${student.full_name} missed ${cls.name} on ${yesterdayStr}`,
                        html: emailBody,
                    }),
                });

                if (res.ok) {
                    sent++;
                } else {
                    const errData = await res.json();
                    failed.push(`${student.guardian_email}: ${errData.message || "Unknown error"}`);
                }
            } catch (err) {
                failed.push(`${student.guardian_email}: ${String(err)}`);
            }
        } else {
            // No Resend key — log what would have been sent
            console.log(`[DRY RUN] Would email ${student.guardian_email} about ${student.full_name}'s absence in ${cls.name}`);
            sent++;
        }

        // Audit log — one per class absence
        await supabase.from("audit_logs").insert({
            action: "absence_notification_sent",
            entity_type: "student",
            entity_id: String(log.student_id),
            details: `Auto-notification sent to ${student.guardian_email} for ${student.full_name}'s absence in ${cls.name} on ${yesterdayStr}`,
            performed_by: null, // System action
        });
    }

    return NextResponse.json({
        sent,
        failed: failed.length,
        failedDetails: failed,
        date: yesterdayStr,
        message: RESEND_KEY ? "Emails sent via Resend" : "Dry run (RESEND_API_KEY not set)",
    });
}
