import { describe, expect, it } from 'vitest';
import { getActiveNavHref, isAuthRoute } from './nav-match';

describe('isAuthRoute', () => {
  it('recognises signed-out screens only', () => {
    expect(isAuthRoute('/login')).toBe(true);
    expect(isAuthRoute('/reset-password/token')).toBe(true);
    expect(isAuthRoute('/')).toBe(false);
    expect(isAuthRoute('/loginx')).toBe(false);
  });
});

const hrefs = ['/', '/plan', '/plan/compare', '/track', '/track/add', '/track/tags', '/settings', '/settings/account'];

describe('getActiveNavHref', () => {
  it('selects the most specific entry', () => {
    expect(getActiveNavHref('/track/tags', hrefs)).toBe('/track/tags');
    expect(getActiveNavHref('/plan/compare', hrefs)).toBe('/plan/compare');
    expect(getActiveNavHref('/settings/account', hrefs)).toBe('/settings/account');
  });

  it('falls back to the parent for unlisted children', () => {
    expect(getActiveNavHref('/track/import', hrefs)).toBe('/track');
  });

  it('matches whole path segments only, and the root exactly', () => {
    expect(getActiveNavHref('/tracking', hrefs)).toBeNull();
    expect(getActiveNavHref('/', hrefs)).toBe('/');
    expect(getActiveNavHref('/dataset', hrefs)).toBeNull();
  });
});
