import { normalizeEmail } from './email';

export function configuredEmails(value: string | undefined): string[] {
  return [...new Set((value ?? '').split(',').map(normalizeEmail).filter(Boolean))];
}

export function isLibraryAdmin(email: string | null | undefined): boolean {
  const admins = configuredEmails(process.env.AUTH_ADMIN_EMAILS);
  if (!admins.length) return process.env.NODE_ENV !== 'production';
  return Boolean(email && admins.includes(normalizeEmail(email)));
}

export function isAnalyticsAdmin(email: string | null | undefined): boolean {
  const admins = configuredEmails(process.env.AUTH_ANALYTICS_ADMIN_EMAILS);
  return admins.length ? Boolean(email && admins.includes(normalizeEmail(email))) : isLibraryAdmin(email);
}

export function isEmailPasswordEnabled(): boolean {
  if (process.env.ENABLE_EMAIL_PASSWORD === 'false') return false;
  return process.env.ENABLE_EMAIL_PASSWORD === 'true'
    || Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}
