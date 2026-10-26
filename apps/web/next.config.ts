import type { NextConfig } from 'next';

// D2 frontend transport: browsers call the same-origin /api prefix and the
// dev server proxies it to the backend, so client code never targets another
// origin directly. Override the backend origin via BLOODLINK_API_ORIGIN.
const apiOrigin = process.env.BLOODLINK_API_ORIGIN ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  // Allow isolated production-build verification without replacing a running
  // development server's .next output. Production defaults remain unchanged.
  distDir: process.env.BLOODLINK_NEXT_DIST_DIR ?? '.next',
  // Allow the sandboxed preview host (and local development) in dev.
  allowedDevOrigins: ['*'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
