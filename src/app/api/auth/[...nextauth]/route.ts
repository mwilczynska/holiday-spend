import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

type RouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

async function withNoIndex(request: Request, context: RouteContext) {
  const response = await handler(request, context);
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

export { withNoIndex as GET, withNoIndex as POST };
