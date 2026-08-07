import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['docusign-esign', 'isomorphic-dompurify', 'jsdom'],
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },

  // Next build typecheck: keep true until `tsc` passes with `.next/types` (Next/TS alignment).
  // Run `npm run type-check` in CI with `exclude` for generated types if you tighten this.
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'docusign-esign': 'commonjs docusign-esign',
      });
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/**' },
      { protocol: 'https', hostname: '**.supabase.in', pathname: '/storage/v1/**' },
    ],
  },
};

export default nextConfig;
