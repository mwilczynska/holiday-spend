// `next dev` and `next build` share one build directory by default, so each wipes the other's
// output and forces a full cold recompile on every switch. That collision surfaced as
// `ChunkLoadError: Loading chunk app/layout failed (timeout)` — a failed chunk load takes down the
// whole React tree, so a slow recompile presents as a broken app rather than a slow one.
// Keeping the two directories separate also stops `.next/cache` interleaving dev and production
// webpack packs, which invalidate each other.
const isDevServer = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a second dev server (tests, a cold-start check) run without wiping this one.
  // Next adds the directory to tsconfig.json includes when it starts; revert that line before committing.
  distDir: process.env.NEXT_DIST_DIR || (isDevServer ? '.next-dev' : '.next'),
  output: 'standalone',
  poweredByHeader: false,
  devIndicators: false,
  // Next 16 rejects requests for dev resources (/_next/*, /__nextjs*, the HMR websocket) whose
  // Origin is not localhost. A phone on the LAN opening http://192.168.x.x:3000 then received the
  // server-rendered page but never hydrated, so Sign in and Enter dev mode stayed disabled.
  // Private-network addresses only; this setting has no effect on `next start`.
  allowedDevOrigins: [
    '10.*.*.*',
    '192.168.*.*',
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  ],
  serverExternalPackages: ['better-sqlite3', 'argon2'],
  outputFileTracingIncludes: {
      '/*': [
        './node_modules/argon2/prebuilds/**/*',
        './docs/prompts/llm_prompt_new_cities_1.md',
        './docs/prompts/llm_prompt_new_cities_v1_1.md',
        './docs/prompts/llm_prompt_intercity_transport_1.md',
        './docs/prompts/llm_prompt_intercity_transport_v1_1.md',
      ],
  },
};

export default nextConfig;
