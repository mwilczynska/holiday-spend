import { redirect } from 'next/navigation';

export default function LegacyCitiesSettingsPage({
  searchParams,
}: {
  searchParams?: { cityId?: string | string[] };
}) {
  const cityId = typeof searchParams?.cityId === 'string' ? searchParams.cityId : null;
  redirect(cityId ? `/dataset?cityId=${encodeURIComponent(cityId)}` : '/dataset');
}
