/**
 * Prompt files the server reads at runtime. Next's file tracing finds a prompt only when its path
 * is a string literal, so these are packaged explicitly by next.config.mjs, the Dockerfile and the
 * production start script, and checked by the container entrypoint. v1.2 was missing from every
 * one of those lists, so a production container started cleanly and then failed every city
 * generation. `src/lib/runtime-prompts.test.ts` fails if this list and its users drift apart.
 */
export const RUNTIME_PROMPT_FILES = [
  'llm_prompt_new_cities_1.md',
  'llm_prompt_new_cities_v1_1.md',
  'llm_prompt_new_cities_v1_2.md',
  'llm_prompt_intercity_transport_1.md',
  'llm_prompt_intercity_transport_v1_1.md',
];
