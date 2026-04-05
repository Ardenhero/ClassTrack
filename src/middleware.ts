import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export async function updateSession(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const isPlaywright = request.headers.get('user-agent')?.includes('Playwright');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // --- 🛡️ SAFETY CHECK: Missing Environment Variables ---
    // Prevent 500 errors during migration if keys aren't set yet
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Middleware: Missing Supabase Environment Variables. Bypassing session check.");
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    try {
        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        supabaseResponse = NextResponse.next({
                            request,
                        })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        // --- 🛡️ KIOSK BYPASS (High Impact Optimization) ---
        // IoT Kiosks heartbeat every 60s and use Service Role keys internally.
        // Bypassing middleware session checks for these routes saves ~43k database hits/month per kiosk.
        if (pathname.startsWith('/api/kiosk/')) {
            return supabaseResponse;
        }

        // --- 🛡️ SESSION OPTIMIZATION ---
        // Use getSession() instead of getUser() for the middleware check.
        // getSession() verifies the JWT locally (zero DB cost), while getUser() hits the DB every time.
        const {
            data: { session },
        } = await supabase.auth.getSession()
        const user = session?.user;

        // --- 🛡️ RATE LIMITING (Pragmatic Security) ---
        // Skip Next.js internal data (_rsc) and common static assets
        const isApi = pathname.startsWith('/api');
        const isAuth = pathname.startsWith('/login') || pathname.startsWith('/api/auth');
        const isRSC = request.nextUrl.searchParams.has('_rsc'); 
        const isStatic = pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?|json)$/);

        if ((isApi || isAuth) && !isRSC && !isStatic && !isPlaywright) {
            const clientIP = getClientIP(request);
            const rateLimit = await checkRateLimit(clientIP, isAuth ? 'auth' : 'api');

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
        }

        // --- 🛡️ CONTENT SECURITY POLICY (CSP) ---
        const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
        const cspHeader = `
            default-src 'none';
            script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'sha256-Jd9G33bjhwopGiRZtfUvGvWzmU+Il8JS3V7ejGjBVgc=';
            script-src-elem 'self' 'nonce-${nonce}' 'strict-dynamic' 'sha256-Jd9G33bjhwopGiRZtfUvGvWzmU+Il8JS3V7ejGjBVgc=';
            style-src 'self' 'nonce-${nonce}' fonts.googleapis.com 'sha256-Vw9WV3SMnQjKSHaaXTz6/TmRsmC9/FgweoFY3xRXghY=' 'sha256-y/7CwTPJQbRWG8gKg35rzYn/jkpp5kIr6Q+32kEMKTA=' 'sha256-fxkN4c/2nO1SmeNIKDXcFVD1poH21fkzl8F/PSmJ8GE=' 'sha256-p2PSMpDa/5boo5l1b0wQgMtThA/LasMB1Ezif8auRsA=' 'sha256-skqujXORqzxt1aE0NNXxujEanPTX6raoqSscTV/Ww/Y=' 'sha256-19U6/ccNF8aPwxmQzpRtgfKkvWkb+WjEmvRtplbo75Q=' 'sha256-4t2hwuCFf/ncOE77y1HXa46OEl+jzS9dH0Gz88/YzbM=';
            style-src-elem 'self' 'nonce-${nonce}' fonts.googleapis.com 'sha256-Vw9WV3SMnQjKSHaaXTz6/TmRsmC9/FgweoFY3xRXghY=' 'sha256-y/7CwTPJQbRWG8gKg35rzYn/jkpp5kIr6Q+32kEMKTA=' 'sha256-fxkN4c/2nO1SmeNIKDXcFVD1poH21fkzl8F/PSmJ8GE=' 'sha256-p2PSMpDa/5boo5l1b0wQgMtThA/LasMB1Ezif8auRsA=' 'sha256-skqujXORqzxt1aE0NNXxujEanPTX6raoqSscTV/Ww/Y=' 'sha256-19U6/ccNF8aPwxmQzpRtgfKkvWkb+WjEmvRtplbo75Q=' 'sha256-4t2hwuCFf/ncOE77y1HXa46OEl+jzS9dH0Gz88/YzbM=';
            style-src-attr 'unsafe-inline';
            img-src 'self' blob: data: *.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://vercel.com https://vercel.live;
            font-src 'self' fonts.gstatic.com;
            connect-src 'self' *.supabase.co wss://*.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL} ${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'wss://')} *.vercel-analytics.com *.vitals.vercel-insights.com https://vercel.live;
            manifest-src 'self' https://classtrack-navy.vercel.app;
            frame-src 'self' https://vercel.live;
            frame-ancestors 'none';
            object-src 'none';
            base-uri 'self';
            form-action 'self';
            upgrade-insecure-requests;
        `.replace(/\s{2,}/g, ' ').trim();

        // Set CSP on response
        supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
        request.headers.set('x-nonce', nonce);
        supabaseResponse.headers.set('X-Frame-Options', 'DENY');
        supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
        supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // --- 🛡️ PAGE ACCESS CONTROL (Lightweight) ---
        // Only enforce "Is logged in?" here. 
        // Role-specific enforcement (Admin vs Student) is moved to Layouts for efficiency.
        const isPublicPath = 
            pathname === '/login' || 
            pathname === '/privacy-policy' ||
            pathname.startsWith('/about') || 
            pathname.startsWith('/auth') ||
            pathname.startsWith('/student/portal');

        if (!user) {
            if (!isPublicPath && !pathname.startsWith('/api')) {
                const url = request.nextUrl.clone()
                url.pathname = '/login'
                return NextResponse.redirect(url)
            }
        }

        return supabaseResponse
    } catch (e) {
        console.error("Middleware Error Caught:", e);
        return NextResponse.next({ request });
    }
}

export async function middleware(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this matcher to fit your needs.
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|woff2?)$).*)',
    ],
}
