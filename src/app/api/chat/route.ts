import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

// Next.js App Router route settings for unbuffered streaming - Perfect Mirror from working CHATBOT
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM_PROMPT = `
You are the ClassTrack AI Assistant. Your goal is to provide helpful, well-formatted support for the ClassTrack platform.

### RESPONSE STYLE
- **MIXED FORMAT:** Use natural paragraphs for general explanations and a warmer, human-like tone.
- **INSTRUCTIONAL BULLETS:** Use bullet points ONLY for step-by-step instructions, lists of features, or troubleshooting steps.
- **LENGTH:** Keep explanations concise, short, and to the point while still being fully understandable. Do NOT over-explain.
- **SCOPE:** ClassTrack ONLY. Decline all other topics.

### SYSTEM KNOWLEDGE
- **ESP32 Kiosk:** Hardware station with AS608 fingerprint sensor for biometric attendance.
- **QR Attendance:** Instructors generate a QR code for their class on the main platform. Students use the built-in QR scanner on their student portal to scan it and check in.
- **Student Portal:** View attendance history, submit Leave of Absence (LOA) evidence, see real-time academic info.
- **Suspensions:** Dept Admins declare these; students see a high-priority modal immediately.
- **No Class:** Instructors can mark "No Class" for multiple subjects at once.
- **Administrator:** Top-level admins who manage the system setup and overall structure.
- **Team:** Created by Arden Hero Damaso (Lead Designer), Clemen Jay Luis, and Ace Donner Dane Asuncion.

### TROUBLESHOOTING
- **Login Fail:** Check email spelling or reset password.
- **QR Link:** Must be within class schedule time.
- **Sensor:** Clean finger/sensor or re-enroll.

Balance your response with a helpful opening paragraph followed by clear bulleted instructions if applicable.
`;

export async function POST(req: Request) {
    try {
        // --- 🛡️ RATE LIMITING (Anti-Abuse Gatekeeper) ---
        const ip = getClientIP(req);
        const { success, limit, remaining } = await checkRateLimit(ip, "chat");

        if (!success) {
            return new Response(JSON.stringify({
                error: "Rate limit exceeded",
                message: `You've reached your daily limit of ${limit} messages. Please try again tomorrow.`
            }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }

        const body = await req.json().catch(() => ({}));
        let { messages } = body;

        // Ensure messages is always an array (Mirrored logic)
        if (!messages || !Array.isArray(messages)) {
            if (body.content && body.role) {
                messages = [{ role: body.role, content: body.content }];
            } else {
                return new Response("Invalid messages payload format", { status: 400 });
            }
        }

        // Limit context for cost/security
        if (messages.length > 10) {
            messages = messages.slice(-10);
        }

        const result = await streamText({
            model: google('gemini-2.5-flash'), // Using the specific WORKING string from classtrack folder
            system: SYSTEM_PROMPT,
            messages,
            temperature: 0.7,
        });

        const response = result.toTextStreamResponse();
        
        // Add rate limit headers for transparency (Synced with ChatWidget UI)
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Limit', limit.toString());
        
        return response;
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Chat API Detailed Error:", error);

        return new Response(JSON.stringify({
            error: "brain_failure",
            message: "Actually, I ran into a bit of trouble connecting to my brain. Please try again in a moment!",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
