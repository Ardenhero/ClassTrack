import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP, isRedisConfigured } from "@/lib/rate-limit";

// Allowed origins for CORS (production + development)
const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://classtrack-navy.vercel.app',
    'http://localhost:3000',
].filter(Boolean) as string[];

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    // Get client IP for rate limiting
    const clientIP = getClientIP(request);
    const pathname = request.nextUrl.pathname;

    // ============================================
    // 0. RATE LIMITING (Upstash Redis or Fallback)
    // ============================================

    // Determine rate limit type based on route
    let rateLimitType: "api" | "auth" | "attendance" | "mutations" = "api";
    if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
        rateLimitType = "auth";
    } else if (pathname.startsWith("/api/attendance") || pathname.startsWith("/api/sync")) {
        rateLimitType = "attendance";
    } else if (pathname.includes("/students") || pathname.includes("/classes")) {
        rateLimitType = "mutations";
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(clientIP, rateLimitType);

    if (!rateLimit.success) {
        return new NextResponse(JSON.stringify({
            error: "Too many requests. Please try again later.",
            retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000)
        }), {
            status: 429,
            headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
                "X-RateLimit-Limit": String(rateLimit.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(rateLimit.reset),
            }
        });
    }

    // Add rate limit headers to response
    supabaseResponse.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    supabaseResponse.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    supabaseResponse.headers.set("X-RateLimit-Reset", String(rateLimit.reset));

    // Indicate if Redis is being used (for debugging)
    if (isRedisConfigured()) {
        supabaseResponse.headers.set("X-RateLimit-Provider", "upstash");
    }

    // ============================================
    // 1. CORS Headers (Restricted Origins)
    // ============================================
    const origin = request.headers.get("origin");
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';

    supabaseResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    // ============================================
    // 2. Security Headers (Production Hardening)
    // ============================================
    supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on');
    supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    supabaseResponse.headers.set('X-Frame-Options', 'DENY');
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // ============================================
    // 3. API Key Protection for Attendance Endpoint
    // ============================================
    // ============================================
    // 3. API Key Protection for Attendance Endpoint
    // ============================================
    // if (pathname.startsWith("/api/attendance") || pathname.startsWith("/api/sync") || pathname.startsWith("/api/attendance/log")) {
    //     const apiKey = request.headers.get("x-api-key") || request.nextUrl.searchParams.get("key");
    //     const validKey = "default-secret-change-me"; // process.env.API_SECRET || "default-secret-change-me";

    //     if (apiKey !== validKey) {
    //         return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
    //             status: 401,
    //             headers: { "Content-Type": "application/json" }
    //         });
    //     }
    // }

    // ============================================
    // 4. Supabase Auth Session
    // ============================================
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    // Re-apply headers
                    supabaseResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
                    supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                    supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
                    supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on');
                    supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
                    supabaseResponse.headers.set('X-Frame-Options', 'DENY');
                    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
                    supabaseResponse.headers.set('Referrer-Policy', 'origin-when-cross-origin');
                    supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
                    supabaseResponse.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
                    supabaseResponse.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));

                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // ============================================
    // 5. Protected Route Redirect
    // ============================================
    if (
        !user &&
        !pathname.startsWith("/login") &&
        !pathname.startsWith("/auth") &&
        !pathname.startsWith("/api/attendance") &&
        !pathname.startsWith("/api/sync") &&
        !pathname.startsWith("/api/health") &&
        !pathname.startsWith("/api/metrics") &&
        !pathname.startsWith("/api/kiosk")
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // ============================================
    // 6. Profile Gate (Netflix-Style)
    // ============================================
    // If user IS logged in, accessing a protected page (like /dashboard),
    // but hasn't selected a profile yet (no cookie), redirect to selection screen.
    const profileId = request.cookies.get("sc_profile_id")?.value;

    if (
        user &&
        !profileId &&
        pathname !== "/select-profile" &&
        !pathname.startsWith("/api") && // Don't block API calls
        !pathname.startsWith("/_next") && // Don't block Next.js assets
        !pathname.includes(".") // Don't block static files
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/select-profile";
        return NextResponse.redirect(url);
    }

    // If user has a profile but tries to go to /select-profile manually, let them (to switch),
    // OR we could redirect them to dashboard. For "Netflix" style, usually /browse is default.
    // Let's decide to allow it so they can switch.

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
