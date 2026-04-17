import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

async function withNoIndex(request: Request) {
  const response = await handler(request);
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

export { withNoIndex as GET, withNoIndex as POST };
