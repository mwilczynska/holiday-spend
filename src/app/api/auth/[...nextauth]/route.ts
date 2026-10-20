import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { instrumentRoute } from '@/lib/analytics/route';

const handler = NextAuth(authOptions);

type RouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

async function withNoIndex(request: Request, context: RouteContext) {
  const response = await handler(request, context);
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

export const GET = instrumentRoute(withNoIndex, '/api/auth/[...nextauth]', 'GET');
export const POST = instrumentRoute(withNoIndex, '/api/auth/[...nextauth]', 'POST');
