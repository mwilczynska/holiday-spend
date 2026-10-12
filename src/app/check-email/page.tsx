import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

type PageProps = {
  searchParams?: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const email = typeof query?.email === 'string' ? query.email : null;
  return <CheckEmailScreen email={email} />;
}
