/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/*': [
        './node_modules/argon2/prebuilds/**/*',
        './docs/prompts/llm_prompt_new_cities_1.md',
        './docs/prompts/llm_prompt_new_cities_v1_1.md',
      ],
    },
  },
};

export default nextConfig;
