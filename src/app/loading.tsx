import { PageLoadingState } from '@/components/ui/loading-state';

export default function Loading() {
  return (
    <PageLoadingState
      title="Loading Wanderledger"
      description="Bringing your latest budgets, plans, and travel activity into view."
      cardCount={4}
      rowCount={5}
    />
  );
}
