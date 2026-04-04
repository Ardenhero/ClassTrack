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
        optimizePackageImports: [
            'lucide-react',
            'date-fns',
            'date-fns-tz',
            'recharts',
            '@supabase/supabase-js',
            'clsx',
            'swr',
            'zod',
            'ai',
            '@ai-sdk/google',
            '@ai-sdk/react',
        ],
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
