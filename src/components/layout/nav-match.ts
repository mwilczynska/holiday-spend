const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/check-email'];

/** Signed-out screens show no app navigation; every link would redirect back to login. */
export function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Picks the single navigation entry for a path: the longest href that equals the path or is a
 * whole-segment prefix of it. `/track/tags` therefore selects Tags rather than Expenses, and
 * `/tracking` would not match `/track`.
 */
export function getActiveNavHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
