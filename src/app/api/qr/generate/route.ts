import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateTOTP, encryptPayload, decryptPayload, validateTOTP } from "@/lib/qr-utils";

export const dynamic = 'force-dynamic';

/**
 * POST /api/qr/generate — Generate an encrypted, geofenced QR code payload.
 * Body: { student_id: number, room_id: string, class_id: string }
 * Returns the encrypted payload string that becomes the QR content.
 */
export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { student_id, room_id, class_id, action } = await request.json();

        if (!student_id || !room_id || !class_id || !action) {
            return NextResponse.json(
                { error: "student_id, room_id, class_id, and action are required" },
                { status: 400 }
            );
        }

        // Verify student exists
        const { data: student } = await supabase
            .from('students')
            .select('id, name, sin')
            .eq('id', student_id)
            .single();

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Verify room exists
        const { data: room } = await supabase
            .from('rooms')
            .select('id, name')
            .eq('id', room_id)
            .single();

        if (!room) {
            return NextResponse.json({ error: "Room not found" }, { status: 404 });
        }

        // Generate TOTP nonce and encrypt payload
        const nonce = generateTOTP();
        const payload = {
            student_id: student.id,
            student_name: student.name,
            room_id: room_id,
            room_name: room.name,
            class_id: class_id,
            action: action,
            nonce,
            timestamp: new Date().toISOString(),
        };

        const encrypted = encryptPayload(payload);

        return NextResponse.json({
            success: true,
            qr_payload: encrypted,
            student_name: student.name,
            room_name: room.name,
            expires_in_seconds: 60,
        });

    } catch (err) {
        console.error("[QR Generate] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/qr/generate — Verify (decrypt) a scanned QR payload.
 * Body: { qr_payload: string, class_id: string }
 * Returns the decoded student info for attendance logging.
 */
export async function PUT(request: Request) {
    try {
        const { qr_payload, class_id } = await request.json();

        if (!qr_payload || !class_id) {
            return NextResponse.json(
                { error: "qr_payload and class_id are required" },
                { status: 400 }
            );
        }

        // Decrypt the payload
        const decoded = decryptPayload(qr_payload) as {
            student_id: number;
            student_name: string;
            room_id: string;
            room_name: string;
            class_id: string;
            action?: string;
            nonce: string;
            timestamp: string;
        } | null;

        if (!decoded) {
            return NextResponse.json(
                { error: "invalid_qr", message: "QR code is invalid or corrupted" },
                { status: 400 }
            );
        }

        // Validate TOTP nonce (must be within 120s window)
        if (!validateTOTP(decoded.nonce)) {
            return NextResponse.json(
                { error: "expired_qr", message: "QR code has expired. Generate a new one." },
                { status: 410 }
            );
        }

        // Validate that the QR code is for the class the instructor selected
        if (decoded.class_id && decoded.class_id !== class_id) {
            return NextResponse.json(
                { error: "class_mismatch", message: "This QR code is for a different class. Please ensure both you and the student have selected the correct class." },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            student_id: decoded.student_id,
            student_name: decoded.student_name,
            room_id: decoded.room_id,
            room_name: decoded.room_name,
            class_id,
            action: decoded.action || "check_in", // Default to check_in for backward compatibility
        });

    } catch (err) {
        console.error("[QR Verify] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
