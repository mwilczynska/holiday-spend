'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuickAddForm } from '@/components/expenses/QuickAddForm';

/** Stand-alone Quick Add, reached from the phone tab bar. On desktop it lives in Expenses. */
export default function QuickAddPage() {
  const [activeSummary, setActiveSummary] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={Plus} title="Quick Add" description={activeSummary ?? 'Record an expense in a few taps.'} />
      <QuickAddForm onActiveLegLoaded={setActiveSummary} />
    </div>
  );
}
