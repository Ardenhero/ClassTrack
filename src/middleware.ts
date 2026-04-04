import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

// Allowed origins for CORS (production + development)
const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://classtrack-navy.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
].filter(Boolean) as string[];

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const userAgent = request.headers.get("user-agent") || "";
    const isDev = process.env.NODE_ENV === 'development';
    const isPlaywright = userAgent.includes("Playwright") && isDev;

    // ============================================
    // 0. ABSOLUTE FAST PATH: Static Assets & Internal Next.js Files
    // ============================================
    // Skip everything for static assets to prevent redirect loops and MIME type errors
    const isStaticAsset = pathname.startsWith("/_next") || pathname.includes(".");
    if (isStaticAsset && !pathname.startsWith("/api")) {
        return NextResponse.next();
    }

    // ============================================
    // 1. SECURITY: Nonce-based Identity Setup
    // ============================================
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    // Initial response object
    const supabaseResponse = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // ============================================
    // 2. PATH TYPE IDENTIFICATION
    // ============================================
    const publicPaths = [
        "/login",
        "/auth",
        "/pending-approval",
        "/api/attendance",
        "/api/sync",
        "/api/health",
        "/api/kiosk",
        "/api/status",
        "/api/auth/signout",
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

    // ============================================
    // 3. RATE LIMITING (Upstash Redis or Fallback)
    // ============================================
    const isApiRequest = pathname.startsWith("/api");
    const isAuthRequest = pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.includes("/auth");

    if (isApiRequest || isAuthRequest) {
        const clientIP = getClientIP(request);
        const isMutation = ["POST", "PUT", "DELETE"].includes(request.method);
        let rateLimitType: "api" | "auth" | "attendance" | "mutations" | "chat" = "api";

        if (isAuthRequest) {
            rateLimitType = "auth";
        } else if (pathname.startsWith("/api/chat")) {
            rateLimitType = "chat";
        } else if (pathname.startsWith("/api/attendance") || pathname.startsWith("/api/sync")) {
            rateLimitType = "attendance";
        } else if (isMutation) {
            rateLimitType = "mutations";
        }

        // IDENTITY ISOLATION: Prevent web-users from spoofing legacy hardware credentials
        const hasSession = request.cookies.has("sb-blpjvjqozhtzectndmxk-auth-token"); // Supabase session cookie
        const hasLegacyEmail = request.nextUrl.searchParams.has("email");
        
        if (hasSession && hasLegacyEmail && isApiRequest) {
            console.warn(`[SECURITY] Blocked browser-based legacy auth attempt for: ${pathname}`);
            return new NextResponse(JSON.stringify({ error: "Legacy authentication is restricted to hardware devices." }), { 
                status: 403, 
                headers: { "Content-Type": "application/json" } 
            });
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

        supabaseResponse.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
        supabaseResponse.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    }

    // ============================================
    // 4. CSP & Security Headers (Strict A+ Configuration)
    // ============================================
    const isProd = process.env.NODE_ENV === 'production';
    const cspHeader = `
        default-src 'none';
        script-src 'self' 'nonce-${nonce}' ${isProd ? '' : "'unsafe-eval'"} *.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL};
        style-src 'self' 'nonce-${nonce}' fonts.googleapis.com;
        img-src 'self' blob: data: *.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL};
        font-src 'self' fonts.gstatic.com;
        connect-src 'self' *.supabase.co wss://*.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL} ${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'wss://')} *.vercel-analytics.com *.vitals.vercel-insights.com;
        frame-ancestors 'none';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
    supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    supabaseResponse.headers.set('X-Frame-Options', 'DENY');
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    supabaseResponse.headers.set('x-nonce', nonce);

    // ============================================
    // 5. CORS & Public Visibility
    // ============================================
    const origin = request.headers.get("origin");
    const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
    const allowedOrigin = isAllowedOrigin ? origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://classtrack-navy.vercel.app');

    supabaseResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-client-info, x-nonce');
    supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    supabaseResponse.headers.set('Vary', 'Origin');

    // ============================================
    // 5b. HARDENED SECURITY HEADERS
    // ============================================
    supabaseResponse.headers.set('X-Frame-Options', 'DENY');
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
    supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on');
    supabaseResponse.headers.set('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining');

    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-client-info',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    // ============================================
    // 6. Supabase Auth Session
    // ============================================
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

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
    // 7. Instructor & Department Guard
    // ============================================
    const isPageRequest = request.headers.get('accept')?.includes('text/html');

    if (isPageRequest && !pathname.startsWith("/_next") && !pathname.includes(".") && !isPlaywright) {
        const { data: instructor } = await supabase
            .from("instructors")
            .select("id, role, department_id, is_super_admin, departments(is_active)")
            .eq("auth_user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (!instructor && pathname !== "/pending-approval" && pathname !== "/select-profile") {
            const url = request.nextUrl.clone();
            url.pathname = "/pending-approval";
            return NextResponse.redirect(url);
        }

        const isSuperAdmin = !!instructor?.is_super_admin;
        // @ts-expect-error: Joined relation
        if (instructor && !isSuperAdmin && instructor.departments && !instructor.departments.is_active) {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            return NextResponse.redirect(url);
        }

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
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
