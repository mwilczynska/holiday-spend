import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.APP_SECRET,
});

export const config = {
  matcher: [
    '/((?!api/auth|login|signup|forgot-password|reset-password|verify-email|check-email|_next/static|_next/image|favicon.ico).*)',
  ],
};
