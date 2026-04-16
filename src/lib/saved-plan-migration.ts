const PLAN_SNAPSHOT_STORAGE_KEY = 'wanderledger-plan-snapshots';

interface LegacySavedPlanSnapshot {
  id: string;
  name: string;
  savedAt: string;
  summary: {
    legCount: number;
    totalNights: number;
    totalBudget: number;
    fixedCostCount: number;
  };
  snapshot: unknown;
}

export async function migrateLocalStoragePlans(): Promise<{ migrated: number; cleared: boolean }> {
  if (typeof window === 'undefined') return { migrated: 0, cleared: false };

  const raw = window.localStorage.getItem(PLAN_SNAPSHOT_STORAGE_KEY);
  if (!raw) return { migrated: 0, cleared: false };

  let snapshots: LegacySavedPlanSnapshot[];
  try {
    snapshots = JSON.parse(raw);
    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      window.localStorage.removeItem(PLAN_SNAPSHOT_STORAGE_KEY);
      return { migrated: 0, cleared: true };
    }
  } catch {
    window.localStorage.removeItem(PLAN_SNAPSHOT_STORAGE_KEY);
    return { migrated: 0, cleared: true };
  }

  let migrated = 0;
  for (const saved of snapshots) {
    try {
      const response = await fetch('/api/saved-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saved.name || 'Imported Plan',
          snapshot: saved.snapshot,
          summary: saved.summary,
        }),
      });
      if (response.ok) {
        migrated += 1;
      }
    } catch {
      // Skip plans that fail to migrate — they may have invalid data.
    }
  }

  window.localStorage.removeItem(PLAN_SNAPSHOT_STORAGE_KEY);
  return { migrated, cleared: true };
}
