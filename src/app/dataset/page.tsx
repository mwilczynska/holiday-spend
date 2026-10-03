import { DatasetClient, type DatasetInitialData } from './DatasetClient';
import { requireCurrentUserId } from '@/lib/auth';
import { loadDatasetData } from '@/lib/dataset-data';
export const dynamic = 'force-dynamic';

export default async function DatasetPage() {
  await requireCurrentUserId();
  let initialData: DatasetInitialData;
  try {
    initialData = await loadDatasetData() as DatasetInitialData;
  } catch {
    initialData = { countries: [], history: [], historyCount: 0, readError: 'Dataset data could not be loaded.' };
  }
  return <DatasetClient initialData={initialData} />;
}
