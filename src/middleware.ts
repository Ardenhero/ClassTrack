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
    // 3. Supabase Auth Session
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
    // 4. Protected Route Redirect (Not Logged In)
    // ============================================
    const publicPaths = [
        "/login",
        "/auth",
        "/pending-approval",
        "/submit-evidence",
        "/api/attendance",
        "/api/sync",
        "/api/health",
        "/api/metrics",
        "/api/kiosk",
        "/api/status",
        "/api/debug/logs",
        "/api/auth/signout",
        "/api/evidence/public-upload",
        "/api/fingerprint",
    ];

    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    if (!user && !isPublicPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // ============================================
    // 5. Account Approval Check
    // ============================================
    // If user is logged in, check if they have an approved instructor profile
    if (user && !isPublicPath && !pathname.startsWith("/_next") && !pathname.includes(".")) {
        // Check if user has an instructor profile (meaning they're approved)
        const { data: instructor } = await supabase
            .from("instructors")
            .select("id, role, department_id, is_super_admin")
            .eq("auth_user_id", user.id)
            .limit(1)
            .maybeSingle();

        const isSuperAdmin = !!instructor?.is_super_admin;

        // If no instructor profile, redirect to pending approval page
        if (!instructor && pathname !== "/pending-approval") {
            const url = request.nextUrl.clone();
            url.pathname = "/pending-approval";
            return NextResponse.redirect(url);
        }

        // If user has profile but is on pending-approval page, redirect to home
        if (instructor && pathname === "/pending-approval") {
            const url = request.nextUrl.clone();
            url.pathname = "/";
            return NextResponse.redirect(url);
        }

        // 6. Department Health Check
        // If the user's department is "Frozen", block access (unless Super Admin)
        if (instructor && !isSuperAdmin) {
            const { data: dept } = await supabase
                .from('departments')
                .select('is_active')
                .eq('id', instructor.department_id)
                .single();

            if (dept && !dept.is_active) {
                const url = request.nextUrl.clone();
                url.pathname = "/login";
                // Optionally add a query param for the error message
                return NextResponse.redirect(url);
            }
        }

        // ============================================
        // 7. Profile Gate (Netflix-Style) - Only for approved users
        // ============================================
        if (instructor) {
            const profileId = request.cookies.get("sc_profile_id")?.value;

            // Admin users OR users with profiles can access
            // Non-admin users without profile selection go to select-profile
            if (
                !profileId &&
                pathname !== "/select-profile" &&
                !pathname.startsWith("/api")
            ) {
                const url = request.nextUrl.clone();
                url.pathname = "/select-profile";
                return NextResponse.redirect(url);
            }
        }
    }

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
