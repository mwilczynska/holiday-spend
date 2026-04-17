import { redirect } from 'next/navigation';
import { SignupScreen } from '@/components/auth/SignupScreen';
import { getAuthSession, getConfiguredAuthProviders } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
