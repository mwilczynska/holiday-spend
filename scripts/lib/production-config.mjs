// Every provider's server key variable; production-config.test.ts checks this against the provider registry.
export const SERVER_LLM_KEY_NAMES = [
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY',
  'PERPLEXITY_API_KEY', 'MISTRAL_API_KEY', 'ZAI_API_KEY', 'DEEPSEEK_API_KEY', 'TOGETHER_API_KEY', 'FIREWORKS_API_KEY',
  'CEREBRAS_API_KEY',
];

export function validateProductionConfig(env) {
  const errors = [];
  if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32 || /change-me|replace-with/i.test(env.NEXTAUTH_SECRET)) errors.push('NEXTAUTH_SECRET must be a fresh random secret of at least 32 characters.');
  let origin;
  for (const key of ['APP_URL', 'NEXTAUTH_URL']) {
    try {
      const url = new URL(env[key]);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
      if (origin && origin !== url.origin) errors.push('APP_URL and NEXTAUTH_URL must use the same public origin.');
      origin = url.origin;
    } catch { errors.push(`${key} must be a public HTTPS origin without a path.`); }
  }
  const emails = value => (value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const admins = emails(env.AUTH_ADMIN_EMAILS);
  if (!admins.length || admins.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.push('AUTH_ADMIN_EMAILS must list at least one administrator email address.');
  const native = env.ENABLE_EMAIL_PASSWORD !== 'false';
  if (native && (!env.RESEND_API_KEY?.trim() || !env.MAIL_FROM?.trim())) errors.push('Email/password auth requires RESEND_API_KEY and a verified MAIL_FROM sender.');
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) errors.push('Google sign-in needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  if (!native && !env.GOOGLE_CLIENT_ID) errors.push('Configure at least one production sign-in method.');
  if (!env.HOLIDAY_SPEND_DB_PATH) errors.push('HOLIDAY_SPEND_DB_PATH must point to the persistent database.');
  if (env.HOLIDAY_SPEND_TRUST_PROXY !== 'true') errors.push('HOLIDAY_SPEND_TRUST_PROXY=true requires a private upstream and a proxy that overwrites X-Real-IP.');
  if (env.AUTH_DEV_PIN || env.APP_SECRET) errors.push('Remove development PIN and APP_SECRET from production configuration.');
  // City and transport calls fall back to these when a request carries no key, and transport
  // estimation is open to every account, so a server key would be spent by anyone who signs up.
  const serverLlmKeys = SERVER_LLM_KEY_NAMES.filter(key => env[key]?.trim());
  if (serverLlmKeys.length) errors.push(`Remove ${serverLlmKeys.join(', ')}: production users supply their own provider keys in the browser.`);
  if (errors.length) throw new Error(errors.join('\n'));
}
