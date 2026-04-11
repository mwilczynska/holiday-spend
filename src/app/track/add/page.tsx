'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingButtonLabel, PageLoadingState } from '@/components/ui/loading-state';
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
  { value: 'food', label: 'Food', emoji: '🍜' },
  { value: 'drinks', label: 'Drinks', emoji: '🍺' },
  { value: 'transport_local', label: 'Transport', emoji: '🚕' },
  { value: 'accommodation', label: 'Accom', emoji: '🏨' },
  { value: 'activities', label: 'Activities', emoji: '🎭' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
];

export default function QuickAddPage() {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [loggedBy, setLoggedBy] = useState<'you' | 'partner'>('you');
  const [activeLeg, setActiveLeg] = useState<ActiveLeg | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActiveLeg() {
      setLoading(true);
      try {
        const [legsRes, countriesRes] = await Promise.all([
          fetch('/api/itinerary'),
          fetch('/api/countries'),
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
    return (
      <PageLoadingState
        title="Loading quick add"
        description="Checking the active leg and local currency before you log an expense."
        cardCount={2}
        rowCount={3}
      />
    );
  }

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSaving(true);

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

      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setAmount('');
          setDescription('');
          setSaved(false);
        }, 1500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Quick Add</h1>
      {activeLeg && (
        <p className="text-sm text-muted-foreground">
          Active: {activeLeg.cityName} ({currency})
        </p>
      )}

      {/* Amount — large and prominent */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm text-muted-foreground">Amount</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-3xl h-14 font-bold text-center"
              autoFocus
            />
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-20 h-14 text-center font-medium"
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
            className="h-14 flex flex-col gap-0.5"
            onClick={() => setCategory(cat.value)}
          >
            <span className="text-lg">{cat.emoji}</span>
            <span className="text-xs">{cat.label}</span>
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
          <Button
            variant={loggedBy === 'you' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLoggedBy('you')}
          >
            You
          </Button>
          <Button
            variant={loggedBy === 'partner' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLoggedBy('partner')}
          >
            Partner
          </Button>
        </div>
      </div>

      {/* Submit */}
      <Button
        className="w-full h-12 text-lg"
        onClick={handleSubmit}
        disabled={saving || !amount || parseFloat(amount) <= 0}
      >
        {saved ? 'Saved!' : (
          <LoadingButtonLabel idle="Add Expense" loading="Saving..." isLoading={saving} />
        )}
      </Button>
    </div>
  );
}
