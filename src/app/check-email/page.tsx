import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

type PageProps = {
  searchParams?: { email?: string };
};

export default function CheckEmailPage({ searchParams }: PageProps) {
  const email = typeof searchParams?.email === 'string' ? searchParams.email : null;
  return <CheckEmailScreen email={email} />;
}
