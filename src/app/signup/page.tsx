import { redirect } from 'next/navigation';
import { SignupScreen } from '@/components/auth/SignupScreen';
import { getAuthSession, getConfiguredAuthProviders } from '@/lib/auth';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

export default async function SignupPage() {
  const session = await getAuthSession();
  if (session?.user?.id) {
    redirect('/');
  }

  const configured = getConfiguredAuthProviders();
  if (!configured.emailPassword) {
    redirect('/login');
  }

  return <SignupScreen />;
}
