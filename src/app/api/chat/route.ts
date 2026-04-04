import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { checkRateLimit } from '@/lib/rate-limit';
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getStudentSession } from "@/lib/student-session";

// Next.js App Router route settings for unbuffered streaming - Perfect Mirror + Zero-Spam Hardening
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM_PROMPT = `
You are the ClassTrack AI Assistant. Your goal is to provide helpful, well-formatted support for the ClassTrack platform.

### RESPONSE STYLE
- **BREVITY IS KEY:** Keep responses under 3-4 sentences maximum. Use punchy, direct language.
- **NO PLEASANTRIES:** Skip the "Hello" and "How can I help" after the first message. Get straight to the facts.
- **INSTRUCTIONAL BULLETS:** Use bullet points ONLY for steps. Limit to 3 bullets max.
- **SCOPE:** ClassTrack ONLY. Decline all other topics immediately.

### SYSTEM KNOWLEDGE
- **ESP32 Kiosk:** Hardware station with AS608 fingerprint sensor for biometric attendance.
- **QR Attendance:** Instructors generate a QR code for their class. Students use the student portal to scan it and check in.
- **Student Portal:** View attendance history, submit LOA evidence, see real-time academic info.
- **Suspensions:** Dept Admins declare these; students see a high-priority modal.
- **No Class:** Instructors can mark "No Class" for multiple subjects.
- **Administrator:** Top-level admins manage system setup.
- **Team:** Arden Hero Damaso (Lead Designer), Clemen Jay Luis, and Ace Donner Dane Asuncion.

### TROUBLESHOOTING
- **Login Fail:** Check email or reset password.
- **QR Link:** Must be within class schedule time.
- **Sensor:** Clean finger/sensor or re-enroll.

Balance your response with a helpful opening paragraph followed by clear bulleted instructions if applicable.
`;

export async function POST(req: Request) {
    // --- 🛡️ IDENTITY VERIFICATION (Zero-Spam Hardening) ---
    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    let userId = user?.id;

    // --- 🛡️ STUDENT SESSION CHECK ---
    if (!userId) {
        const studentSession = await getStudentSession();
        if (studentSession) {
            userId = studentSession.id;
        }
    }

    // Block Guests: Total spam protection
    if (!userId) {
        return new Response(JSON.stringify({ 
            error: "unauthorized",
            message: "Please log in to use ClassTrack Intelligence."
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // --- 🛡️ PRE-FLIGHT CHECK (Brain Identity) ---
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ 
            error: "brain_key_missing",
            message: "My AI brain key is missing on the server! Please verify GOOGLE_GENERATIVE_AI_API_KEY."
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        // --- 🛡️ RATE LIMITING (Account-Based UUID Guard) ---
        // We use userId (UUID) instead of IP to prevent evasion via devices/networks
        const { success, limit, remaining } = await checkRateLimit(userId, "chat");

        if (!success) {
            return new Response(JSON.stringify({
                error: "Rate limit exceeded",
                message: `You've reached your daily limit of ${limit} messages for your account. Please try again tomorrow.`
            }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }

        const body = await req.json().catch(() => ({}));
        let { messages } = body;

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

        const google = createGoogleGenerativeAI({ apiKey });
        const result = await streamText({
            model: google('gemini-2.5-flash'),
            system: SYSTEM_PROMPT,
            messages,
            temperature: 0.7,
        });

        const response = result.toTextStreamResponse();
        
        // Add rate limit headers for transparency - Strictly forced to 10-message cap
        const displayLimit = 10;
        const limitDifference = limit - displayLimit;
        const displayRemaining = Math.max(0, remaining - (limitDifference > 0 ? limitDifference : 0));

        response.headers.set('X-RateLimit-Remaining', displayRemaining.toString());
        response.headers.set('X-RateLimit-Limit', displayLimit.toString());
        
        return response;
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Chat API Identity Failure:", error);

        return new Response(JSON.stringify({
            error: "brain_failure",
            message: "Actually, I ran into a bit of trouble connecting to my brain. Please try again!",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
