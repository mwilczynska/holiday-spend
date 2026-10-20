'use client';
import { useId } from 'react';
import { DISPLAY_CURRENCIES, type DisplayCurrency } from '@/lib/display-currency';
import { useCurrency } from './CurrencyProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
export function CurrencySelector({ settings = false, disabled = false }: { settings?: boolean; disabled?: boolean }) {
  const id = useId(), { currency, rate, asOf, error, saving, draft, change, refresh, discard } = useCurrency();
  return <div className={settings ? 'space-y-2' : 'max-w-full'}>
    {settings ? <Label htmlFor={id}>Display currency</Label> : null}
    <Select value={draft ?? currency} disabled={disabled || saving} onValueChange={value => void change(value as DisplayCurrency)}>
      <SelectTrigger id={id} aria-label="Display currency" className={settings ? 'w-full sm:w-80' : 'h-10 w-[76px] px-2 font-semibold sm:w-[92px] sm:px-3'}>
        <SelectValue>{settings ? (draft ?? currency) + ' — ' + DISPLAY_CURRENCIES[draft ?? currency] : draft ?? currency}</SelectValue>
      </SelectTrigger>
      <SelectContent>{Object.entries(DISPLAY_CURRENCIES).map(([code, name]) => <SelectItem key={code} value={code}>{code} — {name}</SelectItem>)}</SelectContent>
    </Select>
    {settings ? <p className="text-xs text-muted-foreground">Budgets, totals and cost inputs use this currency at the latest available daily rate.{asOf && rate != null ? ' Frankfurter · ' + asOf + ' · 1 AUD = ' + rate + ' ' + currency + '.' : ''}</p> : null}
    {saving ? <p role="status" className="text-xs text-muted-foreground">Saving currency…</p> : null}
    {error ? <div role="alert" className="max-w-sm space-y-1 text-xs text-destructive">
      <p>{error} {draft ? 'Saved currency: ' + currency + '.' : ''}</p>
      <Button size="sm" variant="outline" disabled={saving} onClick={() => void (draft ? change(draft) : refresh())}>Retry currency</Button>
      {draft ? <Button size="sm" variant="ghost" disabled={saving} onClick={discard}>Discard currency change</Button> : null}
    </div> : null}
  </div>;
}
