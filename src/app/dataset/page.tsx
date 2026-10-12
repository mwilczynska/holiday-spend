import { DatasetClient, type DatasetInitialData } from './DatasetClient';
import { requireCurrentUser } from '@/lib/auth';
import { isLibraryAdmin } from '@/lib/auth-policy';
import { loadDatasetData } from '@/lib/dataset-data';
export const dynamic = 'force-dynamic';

export default async function DatasetPage() {
  const user = await requireCurrentUser();
  let initialData: DatasetInitialData;
  try {
    initialData = await loadDatasetData() as DatasetInitialData;
  } catch {
    initialData = { countries: [], history: [], historyCount: 0, readError: 'Dataset data could not be loaded.' };
  }
  return <DatasetClient initialData={initialData} canManageLibrary={isLibraryAdmin(user.email)} />;
}
