import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { accounts, userPasswords, users } from '@/db/schema';
import { AccountSettings } from '@/components/auth/AccountSettings';
import { getAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  const [user, passwordRow, providerAccounts] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .get(),
    db
      .select({ userId: userPasswords.userId })
      .from(userPasswords)
      .where(eq(userPasswords.userId, userId))
      .get(),
    db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .all(),
  ]);

  if (!user) {
    redirect('/login');
  }

  const providerSet = new Set(providerAccounts.map((row) => row.provider));

  return (
    <AccountSettings
      email={user.email ?? ''}
      name={user.name ?? ''}
      hasPassword={Boolean(passwordRow)}
      hasGoogle={providerSet.has('google')}
    />
  );
}
