import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and API login route
  if (pathname === '/login' || pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authToken = request.cookies.get('wanderledger-auth')?.value;
  const appSecret = process.env.APP_SECRET;

  if (!appSecret || authToken !== appSecret) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
