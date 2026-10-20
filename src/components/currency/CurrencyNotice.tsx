'use client';
import { useCurrency } from './CurrencyProvider';
import { Button } from '@/components/ui/button';
export function CurrencyNotice() {
  const { currency, rate, error, refresh, saving } = useCurrency();
  if (rate != null || !error) return null;
  return <div role="alert" className="mb-4 rounded-xl border border-destructive/30 p-3 text-sm">
    <p>{currency} conversions unavailable. {error}</p>
    <Button variant="outline" size="sm" disabled={saving} onClick={() => void refresh()}>Retry exchange rates</Button>
  </div>;
}
