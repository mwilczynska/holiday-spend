import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { isCrossOriginWrite, isTokenAllowed } from '@/lib/request-origin';

const PUBLIC_PATH = /^\/(api\/auth|api\/health|api\/analytics\/events|api\/settings\/analytics|privacy|login|signup|forgot-password|reset-password|verify-email|check-email)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Checked before authentication and for the public auth routes too, so a page on a sibling
  // subdomain cannot sign a visitor in, out or up, or write with their session.
  if (pathname.startsWith('/api/') && isCrossOriginWrite(request)) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (PUBLIC_PATH.test(pathname)) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || process.env.APP_SECRET });
  if (isTokenAllowed(token)) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
