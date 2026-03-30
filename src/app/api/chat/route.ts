import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Next.js App Router route settings for unbuffered streaming - Mirrored from original CHATBOT
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM_PROMPT = `
You are the ClassTrack AI Assistant (Version 1). Your goal is to provide helpful, well-formatted, and extremely concise support for the ClassTrack platform.

### RESPONSE STYLE
- **BREVITY:** Keep all responses short, clear, and to the point. Do NOT over-explain. One short paragraph should usually suffice for most answers.
- **MIXED FORMAT:** Use natural paragraphs for general explanations.
- **INSTRUCTIONAL BULLETS:** Use bullet points only for step-by-step instructions or lists.
- **SCOPE:** ClassTrack ONLY. Decline all other topics.

### SYSTEM KNOWLEDGE
- **ESP32 Kiosk:** Hardware station with AS608 fingerprint sensor for secure biometric attendance logging.
- **QR Attendance:** 
  - **Instructors:** The ONLY ones who generate QR codes for their classes.
  - **Students:** Use the built-in QR scanner in their portal to scan the instructor's code and check in. They CANNOT generate codes.
- **Student Portal:** View attendance history, submit Leave of Absence (LOA) evidence, see real-time academic info.
- **Administrators:** Top-level admins (formerly Super Admin) who manage system setup and overall structure.
- **NOT IMPLEMENTED:** The system DOES NOT currently support energy monitoring, auto-emailing of parents, or student-side QR generation. Avoid mentioning these features.
- **Team:** Created by Arden Hero Damaso (Lead Designer), Clemen Jay Luis, and Ace Donner Dane Asuncion.

### TROUBLESHOOTING
- **Login Fail:** Check email spelling or reset password.
- **QR Link:** Must be within class schedule time.
- **Sensor:** Clean finger/sensor or re-enroll.

Always maintain a professional yet helpful tone while prioritizing speed and clarity.
`;

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        let { messages } = body;

        // Ensure messages is always an array (Mirrored logic)
        if (!messages || !Array.isArray(messages)) {
            console.log("Malformed messages payload received:", body);
            if (body.content && body.role) {
                messages = [body];
            } else {
                return new Response("Invalid messages payload format", { status: 400 });
            }
        }

        const result = await streamText({
            model: google('gemini-2.5-flash'),
            system: SYSTEM_PROMPT,
            messages,
            temperature: 0.7,
        });

        // Use direct text stream response which is highly compatible in Next.js App Router
        return result.toTextStreamResponse();
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Chat API Detailed Error:", error);

        return new Response(JSON.stringify({ 
            error: "An error occurred while processing your request.", 
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
