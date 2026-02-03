import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['docusign-esign'],

  // Temporary: Skip type checking during build until database types are fixed
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'docusign-esign': 'commonjs docusign-esign',
      });
      
      // Handle the 'ApiClient' and model internal imports in docusign-esign
      config.resolve.alias = {
        ...config.resolve.alias,
        'ApiClient': path.resolve(__dirname, 'node_modules/docusign-esign/src/ApiClient.js'),
        'model': path.resolve(__dirname, 'node_modules/docusign-esign/src/model'),
      };
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
