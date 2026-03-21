import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['docusign-esign'],

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
