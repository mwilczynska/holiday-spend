/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./node_modules/argon2/prebuilds/**/*'],
    },
  },
};

export default nextConfig;
