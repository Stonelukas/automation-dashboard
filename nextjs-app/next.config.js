/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    outputFileTracingRoot: require('path').join(__dirname, '..'),
    experimental: {
        optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
        // Optimize CSS loading
        optimizeCss: false,
    },
    // Server external packages (moved from experimental)
    serverExternalPackages: ['socket.io-client'],
    // Turbopack configuration (stable feature)
    turbopack: {
        resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        resolveAlias: {
            '@': './src',
            '@/components': './src/components',
            '@/hooks': './src/hooks',
            '@/utils': './src/utils',
            '@/types': './src/types',
            '@/lib': './src/lib',
        },
    },
    // Performance optimizations
    poweredByHeader: false,
    compress: true,
    // Image optimization
    images: {
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60,
        dangerouslyAllowSVG: false,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
    // Enable WebSocket support for Socket.IO
    async rewrites() {
        return [
            {
                source: '/socket.io/:path*',
                destination: 'http://localhost:8080/socket.io/:path*',
            },
        ];
    },
    // Proxy API requests to backend during development
    async redirects() {
        return [];
    },
    // Turbopack doesn't support webpack config, use turbo config above instead
    ...(process.env.NODE_ENV === 'development' ? {} : {
        webpack: (config) => {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
            };
            return config;
        },
    }),
};

module.exports = nextConfig;
