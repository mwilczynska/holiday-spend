import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { getAuthSession, getConfiguredAuthProviders } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session?.user?.id) {
    redirect('/');
  }

  const configuredProviders = getConfiguredAuthProviders();

  return (
    <LoginScreen
      hasGoogle={configuredProviders.google}
      hasEmailPassword={configuredProviders.emailPassword}
      hasDevPin={configuredProviders.devPin}
    />
  );
}
