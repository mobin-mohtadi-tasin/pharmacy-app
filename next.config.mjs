/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only for self-hosted Docker, not Vercel
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
