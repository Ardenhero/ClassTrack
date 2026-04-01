/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    compress: true,
    output: "standalone",
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
    experimental: {
        optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'eojurhpatqvxjinwlmpf.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'blpjvjqozhtzectndmxk.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
        minimumCacheTTL: 31536000,
    },
    // Security Headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.vercel-scripts.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' blob: data: *.supabase.co; font-src 'self' fonts.gstatic.com; connect-src 'self' *.supabase.co *.vercel-analytics.com *.vitals.vercel-insights.com; frame-ancestors 'none'; upgrade-insecure-requests;",
                    },
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=self, microphone=(), geolocation=(), interest-cohort=()',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
