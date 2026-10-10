'use client';

import { useEffect, useRef, useState } from 'react';
import { BedDouble, Bus, ShoppingBag, Ticket, Utensils, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineLoadingState, LoadingButtonLabel } from '@/components/ui/loading-state';
import { EXPENSE_CATEGORIES } from '@/types';

interface ActiveLeg {
  id: number;
  cityName: string;
  countryId: string;
  currency?: string;
}

interface Country {
  id: string;
  currencyCode: string;
}

const QUICK_CATEGORIES = [
  { value: 'food', label: 'Food', icon: Utensils },
  { value: 'drinks', label: 'Drinks', icon: Wine },
  { value: 'transport_local', label: 'Transport', icon: Bus },
  { value: 'accommodation', label: 'Accom', icon: BedDouble },
  { value: 'activities', label: 'Activities', icon: Ticket },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag },
];

/**
 * Today's expense in a few taps: amount in the active leg's currency, a category, an optional
 * description. Used on its own page (phone tab bar) and in the Expenses page's Quick add dialog.
 */
export function QuickAddForm({
  onSaved,
  onActiveLegLoaded,
}: {
  /** Called after a confirmed save, e.g. to refresh the expense list behind a dialog. */
  onSaved?: () => void;
  /** Reports the active leg and currency so a host can show them in its own header. */
  onActiveLegLoaded?: (summary: string | null) => void;
}) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [loggedBy, setLoggedBy] = useState<'you' | 'partner'>('you');
  const [activeLeg, setActiveLeg] = useState<ActiveLeg | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conversionWarning, setConversionWarning] = useState<string | null>(null);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(true);
  const reportActiveLeg = useRef(onActiveLegLoaded);
  reportActiveLeg.current = onActiveLegLoaded;

  useEffect(() => {
    async function loadActiveLeg() {
      setLoading(true);
      try {
        const [legsRes, countriesRes] = await Promise.all([
          fetch('/api/itinerary'),
          // Only currencyCode is read from the matched country, so skip the nested
          // city rows: the full payload is ~166 KB against ~5.5 KB here.
          fetch('/api/countries?includeCities=false'),
        ]);
        const legsData = await legsRes.json();
        const countriesData = await countriesRes.json();

        const legs = legsData.data || [];
        const active = legs.find((l: { status: string }) => l.status === 'active');

        if (active) {
          const countries: Country[] = (countriesData.data || []).flatMap(
            (c: Country & { cities?: { countryId: string }[] }) => [c]
          );
          const country = countries.find((c: Country) => c.id === active.countryId);
          setActiveLeg({
            id: active.id,
            cityName: active.cityName,
            countryId: active.countryId,
            currency: country?.currencyCode,
          });
          if (country?.currencyCode) setCurrency(country.currencyCode);
          reportActiveLeg.current?.(`Active: ${active.cityName} (${country?.currencyCode ?? 'AUD'})`);
        } else {
          reportActiveLeg.current?.(null);
        }
      } catch {
        // Ignore errors loading active leg
      } finally {
        setLoading(false);
      }
    }
    loadActiveLeg();
  }, []);

  if (loading) {
    return <InlineLoadingState title="Loading quick add" detail="Checking the active leg and local currency." />;
  }

  const handleSubmit = async () => {
    if (submitting.current || saved || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
    submitting.current = true;
    setSaving(true);
    setSaveError(null);
    setConversionWarning(null);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          amount: parseFloat(amount),
          currency,
          category,
          description: description || undefined,
          legId: activeLeg?.id,
          loggedBy,
          source: 'manual',
        }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || `Could not save expense (HTTP ${res.status}). Try again.`);
      if (!result?.data) throw new Error('The server returned an unreadable save response. Check Expenses before retrying.');
      if (result.data.amountAud == null && currency !== 'AUD') {
        setConversionWarning('Expense saved without an AUD conversion because the exchange rate is unavailable. It will not count toward AUD totals until converted.');
      }
      setSaved(true);
      setAmount('');
      setDescription('');
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save expense. Check your connection and try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Amount — large and prominent */}
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="quick-amount" className="text-sm text-muted-foreground">Amount</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="quick-amount"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSaved(false); }}
              className="h-14 text-center text-3xl font-bold"
              autoFocus
            />
            <Input
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="h-14 w-20 text-center font-medium"
              maxLength={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick category buttons */}
      <div className="grid grid-cols-3 gap-2">
        {QUICK_CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={category === cat.value ? 'default' : 'outline'}
            className="flex h-16 flex-col gap-1 rounded-xl"
            onClick={() => setCategory(cat.value)}
          >
            <cat.icon className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold">{cat.label}</span>
          </Button>
        ))}
      </div>

      {/* More categories */}
      <div className="flex flex-wrap gap-1">
        {EXPENSE_CATEGORIES.filter(c => !QUICK_CATEGORIES.find(q => q.value === c.value)).map((cat) => (
          <Button
            key={cat.value}
            variant={category === cat.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Description */}
      <Input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {/* Logged By */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">Logged By</Label>
        <div className="flex gap-1">
          <Button variant={loggedBy === 'you' ? 'default' : 'outline'} size="sm" onClick={() => setLoggedBy('you')}>
            You
          </Button>
          <Button variant={loggedBy === 'partner' ? 'default' : 'outline'} size="sm" onClick={() => setLoggedBy('partner')}>
            Partner
          </Button>
        </div>
      </div>

      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      {conversionWarning && <p role="status" className="text-sm text-muted-foreground">{conversionWarning}</p>}
      {/* Submit */}
      <Button
        className="h-12 w-full text-lg"
        onClick={handleSubmit}
        disabled={saving || saved || !amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
      >
        {saved ? 'Saved!' : (
          <LoadingButtonLabel idle="Add Expense" loading="Saving..." isLoading={saving} />
        )}
      </Button>
    </div>
  );
}
