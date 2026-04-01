import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

// Allowed origins for CORS (production + development)
const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://classtrack-navy.vercel.app',
    'http://localhost:3000',
].filter(Boolean) as string[];

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const supabaseResponse = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    // ============================================
    // 0. PATH TYPE IDENTIFICATION
    // ============================================
    const publicPaths = [
        "/login",
        "/auth",
        "/pending-approval",
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
        "/api/iot",
        "/student/portal",
        "/api/student/attendance",
        "/api/student/academic-info",
        "/api/qr",
        "/api/academic-terms",
        "/api/chat",
        "/manifest.json",
        "/favicon.ico",
    ];

    const isPublicPath = publicPaths.some(p => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
    const isStaticAsset = pathname.startsWith("/_next") || pathname.includes(".");

    // FAST PATH: Skip everything for static assets
    if (isStaticAsset && !pathname.startsWith("/api")) {
        return supabaseResponse;
    }

    // ============================================
    // 1. RATE LIMITING (Upstash Redis or Fallback)
    // ============================================
    // Only rate limit API and Auth routes to ensure page navigation is instant
    const isApiRequest = pathname.startsWith("/api");
    const isAuthRequest = pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.includes("/auth");

    if (isApiRequest || isAuthRequest) {
        const clientIP = getClientIP(request);

        // Determine rate limit type
        let rateLimitType: "api" | "auth" | "attendance" | "mutations" = "api";
        if (isAuthRequest) {
            rateLimitType = "auth";
        } else if (pathname.startsWith("/api/attendance") || pathname.startsWith("/api/sync")) {
            rateLimitType = "attendance";
        } else if (pathname.includes("/students") || pathname.includes("/classes")) {
            rateLimitType = "mutations";
        }

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
                }
            });
        }

        // Add rate limit headers
        supabaseResponse.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
        supabaseResponse.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    }

    // ============================================
    // 2. CSP & Security Headers (Nonce-based)
    // ============================================
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
        style-src 'self' 'unsafe-inline' fonts.googleapis.com;
        img-src 'self' blob: data: *.supabase.co;
        font-src 'self' fonts.gstatic.com;
        connect-src 'self' *.supabase.co *.vercel-analytics.com *.vitals.vercel-insights.com;
        frame-ancestors 'none';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    // Set CSP on response
    supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
    // Set custom x-nonce on request so server components can access it
    request.headers.set('x-nonce', nonce);

    const origin = request.headers.get("origin");
    // Strictly filter origin
    const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
    const allowedOrigin = isAllowedOrigin ? origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://classtrack-navy.vercel.app');

    if (isAllowedOrigin) {
        supabaseResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
        supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-client-info');
        supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-client-info',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    // ============================================
    // 3. Supabase Auth Session
    // ============================================
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    // Note: We don't recreate the response here to save time, we just set the cookies later
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Skip heavy auth for public paths
    if (isPublicPath) {
        return supabaseResponse;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // ============================================
    // 4. Instructor & Department Guard (Optimized)
    // ============================================
    const isPageRequest = request.headers.get('accept')?.includes('text/html');

    if (isPageRequest && !pathname.startsWith("/_next") && !pathname.includes(".")) {
        // COMBINED QUERY: Fetch instructor role AND department status in one hit
        const { data: instructor } = await supabase
            .from("instructors")
            .select("id, role, department_id, is_super_admin, departments(is_active)")
            .eq("auth_user_id", user.id)
            .limit(1)
            .maybeSingle();

        const isSuperAdmin = !!instructor?.is_super_admin;

        // 1. Profile Existence Check
        if (!instructor && pathname !== "/pending-approval" && pathname !== "/select-profile") {
            const url = request.nextUrl.clone();
            url.pathname = "/pending-approval";
            return NextResponse.redirect(url);
        }

        // 2. Department Frozen Check (Skip for Super Admins)
        // @ts-expect-error: Joined relation
        if (instructor && !isSuperAdmin && instructor.departments && !instructor.departments.is_active) {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            return NextResponse.redirect(url);
        }

        // 3. Profile Selection Check
        if (instructor && !isSuperAdmin) {
            const profileId = request.cookies.get("sc_profile_id")?.value;
            if (!profileId && pathname !== "/select-profile" && !pathname.startsWith("/api")) {
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
