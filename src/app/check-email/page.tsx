import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: { email?: string };
};

export default function CheckEmailPage({ searchParams }: PageProps) {
  const email = typeof searchParams?.email === 'string' ? searchParams.email : null;
  return <CheckEmailScreen email={email} />;
}
