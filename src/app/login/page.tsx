import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { getAuthSession, getConfiguredAuthProviders } from '@/lib/auth';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

type PageProps = {
  searchParams?: { reset?: string; linkRequired?: string };
};

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (session?.user?.id) {
    redirect('/');
  }

  const configuredProviders = getConfiguredAuthProviders();
  const passwordResetSuccess = searchParams?.reset === 'success';
  const linkRequired =
    searchParams?.linkRequired === 'google' || searchParams?.linkRequired === 'password'
      ? searchParams.linkRequired
      : null;

  return (
    <LoginScreen
      hasGoogle={configuredProviders.google}
      hasEmailPassword={configuredProviders.emailPassword}
      hasDevPin={configuredProviders.devPin}
      passwordResetSuccess={passwordResetSuccess}
      linkRequired={linkRequired}
    />
  );
}
