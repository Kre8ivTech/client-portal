/** @type {import('next').NextContext} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/**' },
      { protocol: 'https', hostname: '**.supabase.in', pathname: '/storage/v1/**' },
    ],
  },
};

export default nextConfig;
