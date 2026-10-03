import { SettingsClient, type SettingsInitialData } from './SettingsClient';
import { requireCurrentUserId } from '@/lib/auth';
import { loadSettingsData } from '@/lib/settings-data';
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const userId = await requireCurrentUserId();
  let initialData: SettingsInitialData;
  try {
    initialData = await loadSettingsData(userId);
  } catch {
    initialData = { costs: [], countries: [], groupSize: null, llm: null, readError: 'Settings data could not be loaded.' };
  }
  return <SettingsClient initialData={initialData} />;
}
