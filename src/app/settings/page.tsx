import { SettingsClient } from './SettingsClient';
import { requireCurrentUserId } from '@/lib/auth';
import { loadSettingsData } from '@/lib/settings-data';
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const userId = await requireCurrentUserId();
  return <SettingsClient initialData={await loadSettingsData(userId)} />;
}
