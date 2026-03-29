import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Next.js App Router route settings for unbuffered streaming - Mirrored from original CHATBOT
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM_PROMPT = `
You are the ClassTrack AI Assistant. Your goal is to provide helpful, well-formatted support for the ClassTrack platform.

### RESPONSE STYLE
- **MIXED FORMAT:** Use natural paragraphs for general explanations and a warmer, human-like tone.
- **INSTRUCTIONAL BULLETS:** Use bullet points ONLY for step-by-step instructions, lists of features, or troubleshooting steps.
- **LENGTH:** Provide more detail than before. Aim for 5-8 sentences or items per response unless the question is very simple.
- **SCOPE:** ClassTrack ONLY. Decline all other topics.

### SYSTEM KNOWLEDGE
- **ESP32 Kiosk:** Hardware station with AS608 fingerprint sensor for biometric attendance.
- **QR Attendance:** Students generate QR in portal; Instructors scan them for instant check-in.
- **Student Portal:** View attendance history, submitt Leave of Absence (LOA) evidence, see real-time academic info.
- **Suspensions:** Dept Admins declare these; students see a high-priority modal immediately.
- **No Class:** Instructors can mark "No Class" for multiple subjects at once.
- **Energy Monitoring:** Super Admins track real-time watts/volts and control IoT switches.
- **Team:** Created by Arden Hero Damaso (Lead Designer), Clemen Jay Luis, and Ace Donner Dane Asuncion.

### TROUBLESHOOTING
- **Login Fail:** Check email spelling or reset password.
- **QR Link:** Must be within class schedule time.
- **Sensor:** Clean finger/sensor or re-enroll.

Balance your response with a helpful opening paragraph followed by clear bulleted instructions if applicable.
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
