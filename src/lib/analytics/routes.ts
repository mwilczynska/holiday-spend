export const ANALYTICS_ROUTES = ['/', '/plan', '/plan/compare', '/track', '/track/add', '/track/tags', '/track/import', '/dataset', '/estimates', '/settings', '/settings/account', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/check-email', '/admin/analytics', '/privacy'] as const;
export function normalizedPage(path: string): (typeof ANALYTICS_ROUTES)[number] | null {
  const route = path.split(/[?#]/)[0];
  return ANALYTICS_ROUTES.find(value => value === route) ?? null;
}
