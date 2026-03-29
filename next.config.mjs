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
    // Security Headers are handled in middleware.ts
};

export default nextConfig;
