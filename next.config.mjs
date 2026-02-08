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
    // Security Headers are handled in middleware.ts
};

export default nextConfig;
