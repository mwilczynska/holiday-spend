import { DatasetClient, type DatasetInitialData } from './DatasetClient';
import { requireCurrentUserId } from '@/lib/auth';
import { loadDatasetData } from '@/lib/dataset-data';
export const dynamic = 'force-dynamic';

export default async function DatasetPage() {
  await requireCurrentUserId();
  return <DatasetClient initialData={await loadDatasetData() as DatasetInitialData} />;
}
