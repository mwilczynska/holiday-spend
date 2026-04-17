export type AuthLinkPath = '/verify-email' | '/reset-password';

export function buildAuthLink(path: AuthLinkPath, rawToken: string, request: Request): string {
  const base = process.env.APP_URL?.replace(/\/+$/, '') ?? new URL(request.url).origin;
  return `${base}${path}?token=${encodeURIComponent(rawToken)}`;
}
