// `next dev` and `next build` share one build directory by default, so each wipes the other's
// output and forces a full cold recompile on every switch. That collision surfaced as
// `ChunkLoadError: Loading chunk app/layout failed (timeout)` — a failed chunk load takes down the
// whole React tree, so a slow recompile presents as a broken app rather than a slow one.
// Keeping the two directories separate also stops `.next/cache` interleaving dev and production
// webpack packs, which invalidate each other.
const isDevServer = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: isDevServer ? '.next-dev' : '.next',
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
