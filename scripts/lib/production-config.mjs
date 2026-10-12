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
  const allowed = emails(env.AUTH_ALLOWED_EMAILS);
  const admins = emails(env.AUTH_ADMIN_EMAILS);
  if (!allowed.length || allowed.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.push('AUTH_ALLOWED_EMAILS must list the private accounts allowed to sign in.');
  if (!admins.length || admins.some(email => !allowed.includes(email))) errors.push('AUTH_ADMIN_EMAILS must contain an administrator included in AUTH_ALLOWED_EMAILS.');
  const native = env.ENABLE_EMAIL_PASSWORD !== 'false';
  if (native && (!env.RESEND_API_KEY?.trim() || !env.MAIL_FROM?.trim())) errors.push('Email/password auth requires RESEND_API_KEY and a verified MAIL_FROM sender.');
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) errors.push('Google sign-in needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  if (!native && !env.GOOGLE_CLIENT_ID) errors.push('Configure at least one production sign-in method.');
  if (!env.HOLIDAY_SPEND_DB_PATH) errors.push('HOLIDAY_SPEND_DB_PATH must point to the persistent database.');
  if (env.HOLIDAY_SPEND_TRUST_PROXY !== 'true') errors.push('HOLIDAY_SPEND_TRUST_PROXY=true requires a private upstream and a proxy that overwrites X-Real-IP.');
  if (env.AUTH_DEV_PIN || env.APP_SECRET) errors.push('Remove development PIN and APP_SECRET from production configuration.');
  if (errors.length) throw new Error(errors.join('\n'));
}
