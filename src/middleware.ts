import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // getUser(). A simple mistake could make it very hard to debug
    // sessions are being refreshed incorrectly.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname;
    const isProd = process.env.NODE_ENV === 'production';
    const isPlaywright = request.headers.get('user-agent')?.includes('Playwright');

    // --- 🛡️ RATE LIMITING (Pragmatic Security) ---
    // Only rate limit API, Login, and sensitive routes
    // Skip Next.js internal data (_rsc) and common static assets to prevent 429s on shared WiFi
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
    const nonce = btoa(crypto.randomUUID());
    
    // Nonce is used primarily for scripts. Styles and frames are relaxed for Vercel/Tailwind compatibility.
    const cspHeader = `
        default-src 'none';
        script-src 'self' 'nonce-${nonce}' ${isProd ? '' : "'unsafe-eval'"} *.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://vercel.live;
        script-src-elem 'self' 'nonce-${nonce}' *.supabase.co ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://vercel.live 'unsafe-inline';
        style-src 'self' 'unsafe-inline' fonts.googleapis.com;
        style-src-elem 'self' 'unsafe-inline' fonts.googleapis.com;
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

    supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
    supabaseResponse.headers.set('x-nonce', nonce);
    supabaseResponse.headers.set('X-Frame-Options', 'DENY');
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // --- 🛡️ PAGE ACCESS CONTROL ---
    const isPublicPath = 
        pathname === '/' || 
        pathname === '/login' || 
        pathname === '/privacy-policy' ||
        pathname.startsWith('/about') || 
        pathname.startsWith('/auth') ||
        pathname.startsWith('/student/portal/excuse');

    if (!user) {
        if (!isPublicPath && !pathname.startsWith('/api')) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
    } else {
        // Redirect from login to dashboard if already logged in
        if (pathname === '/login') {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const url = request.nextUrl.clone()
            url.pathname = (profile?.role === 'student') ? '/student/portal/dashboard' : '/dashboard'
            return NextResponse.redirect(url)
        }

        // Student Role Protection
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role === 'student') {
            if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/students')) {
                const url = request.nextUrl.clone()
                url.pathname = '/student/portal/dashboard'
                return NextResponse.redirect(url)
            }
        } else {
            // Admin/Instructor Protection from Student Portal
            if (pathname.startsWith('/student/portal') && pathname !== '/student/portal/excuse') {
                const url = request.nextUrl.clone()
                url.pathname = '/dashboard'
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
