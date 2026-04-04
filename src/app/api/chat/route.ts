import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { checkRateLimit } from '@/lib/rate-limit';
import { createServerClient } from "@supabase/ssr";

// Next.js App Router route settings for unbuffered streaming - Perfect Mirror + Zero-Spam Hardening
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM_PROMPT = `
You are the ClassTrack AI Assistant. Your goal is to provide helpful, well-formatted support for the ClassTrack platform.

### RESPONSE STYLE
- **MAX LENGTH:** Do NOT exceed 200 words. Be extremadamente concise.
- **MIXED FORMAT:** Use short, helpful paragraphs (2-3 sentences max) for context.
- **PRIORITIZE BULLETS:** Use bulleted points for features, steps, and lists to make info easy to scan.
- **SCOPE:** ClassTrack ONLY. Decline all other topics.

### SYSTEM KNOWLEDGE
- **ESP32 Kiosk:** Hardware station with AS608 fingerprint sensor for biometric attendance.
- **QR Attendance:** Instructors generate a QR code for their class. Students scan it to check in.
- **Student Portal:** View attendance history, submit Excuse Letters (5/month limit), see real-time academic info.
- **Suspensions:** Dept Admins declare these; students see a high-priority modal.
- **No Class:** Instructors can mark "No Class" for subjects.
- **Team:** Arden Hero Damaso (Lead Designer), Clemen Jay Luis, and Ace Donner Dane Asuncion.

### TROUBLESHOOTING
- **Login Fail:** Check email or reset password.
- **QR Link:** Must be within class schedule time.
- **Sensor:** Clean finger/sensor or re-enroll.

Always open with a brief paragraph followed by clear bulleted points.
`;

export async function POST(req: Request) {
    // --- 🛡️ IDENTITY VERIFICATION (Edge-Optimized Auth) ---
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    const cookieHeader = req.headers.get('cookie') ?? '';
                    return cookieHeader.split(';').map(c => {
                        const [name, ...val] = c.trim().split('=');
                        return { name, value: val.join('=') };
                    });
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Block Guests: Total spam protection
    if (!user) {
        return new Response(JSON.stringify({
            error: "unauthorized",
            message: "Authentication failed. Please refresh and log in again."
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
        // We use user.id (UUID) instead of IP to prevent evasion via devices/networks
        const { success, limit, remaining } = await checkRateLimit(user.id, "chat");

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

        // Limit context for cost/security (last 5 exchanges only)
        if (messages.length > 5) {
            messages = messages.slice(-5);
        }

        // Server-side input length guard (prevent token-bleed from long messages)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && typeof lastMessage.content === 'string' && lastMessage.content.length > 500) {
            return new Response(JSON.stringify({
                error: "message_too_long",
                message: "Please keep your message under 500 characters."
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const google = createGoogleGenerativeAI({ apiKey });
        const result = await streamText({
            model: google('gemini-1.5-flash'),
            system: SYSTEM_PROMPT,
            messages,
            temperature: 0.3,
            maxOutputTokens: 250,
        });

        const response = result.toTextStreamResponse();

        // Add rate limit headers for transparency
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Limit', limit.toString());

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
