import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || process.env.APP_SECRET });
  if (token?.sub) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!api/auth|api/health|login|signup|forgot-password|reset-password|verify-email|check-email|_next/static|_next/image|favicon.ico).*)'],
};
