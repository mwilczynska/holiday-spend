'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CityPriceInputData, EstimateConfidence } from '@/types';

interface AnchorInputRecord extends CityPriceInputData {
  id: number;
  cityId: string;
  capturedAt: string;
  sourceType: string;
  sourceDetail: string | null;
  confidence: string | null;
  notes: string | null;
  isActive: number | null;
}

interface AnchorInputForm extends CityPriceInputData {
  sourceType: string;
  sourceDetail: string;
  confidence: EstimateConfidence;
  notes: string;
}

interface CityAnchorInputEditorProps {
  cityId: string;
  cityName: string;
  onSaved: () => void;
}

interface AnchorField {
  key: keyof CityPriceInputData;
  label: string;
}

const DEFAULT_FORM: AnchorInputForm = {
  sourceType: 'manual_import',
  sourceDetail: '',
  confidence: 'high',
  notes: '',
  accomHostel: undefined,
  accomPrivateRoom: undefined,
  accom1star: undefined,
  accom2star: undefined,
  accom3star: undefined,
  accom4star: undefined,
  streetMeal: undefined,
  cheapRestaurantMeal: undefined,
  midRestaurantMeal: undefined,
  coffee: undefined,
  localBeer: undefined,
  importBeer: undefined,
  wineGlass: undefined,
  cocktail: undefined,
  activityBudget: undefined,
  activityMid: undefined,
  activityHigh: undefined,
};

const FIELD_GROUPS: Array<{ title: string; description: string; fields: AnchorField[] }> = [
  {
    title: 'Accommodation Anchors',
    description: 'Nightly AUD anchors for two people.',
    fields: [
      { key: 'accomHostel', label: 'Shared Hostel Dorm' },
      { key: 'accomPrivateRoom', label: 'Private Room' },
      { key: 'accom1star', label: '1-Star' },
      { key: 'accom2star', label: '2-Star' },
      { key: 'accom3star', label: '3-Star' },
      { key: 'accom4star', label: '4-Star' },
    ],
  },
  {
    title: 'Food and Drinks Anchors',
    description: 'Unit prices in AUD used by the hybrid formulas.',
    fields: [
      { key: 'streetMeal', label: 'Street Meal' },
      { key: 'cheapRestaurantMeal', label: 'Cheap Restaurant Meal' },
      { key: 'midRestaurantMeal', label: 'Mid-Range Meal' },
      { key: 'coffee', label: 'Coffee' },
      { key: 'localBeer', label: 'Local Beer' },
      { key: 'importBeer', label: 'Imported Beer' },
      { key: 'wineGlass', label: 'Wine Glass' },
      { key: 'cocktail', label: 'Cocktail' },
    ],
  },
  {
    title: 'Activity Anchors',
    description: 'AUD anchor prices for paid experiences used by the hybrid formulas.',
    fields: [
      { key: 'activityBudget', label: 'Budget Activity' },
      { key: 'activityMid', label: 'Mid Activity' },
      { key: 'activityHigh', label: 'Premium Activity' },
    ],
  },
];

function toForm(record: AnchorInputRecord | null): AnchorInputForm {
  if (!record) return { ...DEFAULT_FORM };

  return {
    sourceType: record.sourceType || 'manual_import',
    sourceDetail: record.sourceDetail || '',
    confidence: (record.confidence as EstimateConfidence | null) || 'medium',
    notes: record.notes || '',
    accomHostel: record.accomHostel ?? undefined,
    accomPrivateRoom: record.accomPrivateRoom ?? undefined,
    accom1star: record.accom1star ?? undefined,
    accom2star: record.accom2star ?? undefined,
    accom3star: record.accom3star ?? undefined,
    accom4star: record.accom4star ?? undefined,
    streetMeal: record.streetMeal ?? undefined,
    cheapRestaurantMeal: record.cheapRestaurantMeal ?? undefined,
    midRestaurantMeal: record.midRestaurantMeal ?? undefined,
    coffee: record.coffee ?? undefined,
    localBeer: record.localBeer ?? undefined,
    importBeer: record.importBeer ?? undefined,
    wineGlass: record.wineGlass ?? undefined,
    cocktail: record.cocktail ?? undefined,
    activityBudget: record.activityBudget ?? undefined,
    activityMid: record.activityMid ?? undefined,
    activityHigh: record.activityHigh ?? undefined,
  };
}

export function CityAnchorInputEditor({ cityId, cityName, onSaved }: CityAnchorInputEditorProps) {
  const [form, setForm] = useState<AnchorInputForm>({ ...DEFAULT_FORM });
  const [history, setHistory] = useState<AnchorInputRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/cities/${cityId}/inputs`);
        const data = await response.json();
        const current = (data.data?.current as AnchorInputRecord | null) || null;
        const nextHistory = (data.data?.history as AnchorInputRecord[]) || [];
        setForm(toForm(current));
        setHistory(nextHistory);
      } catch {
        setMessage('Failed to load anchor inputs.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [cityId]);

  const setNumericField = (key: keyof CityPriceInputData, rawValue: string) => {
    setForm((current) => ({
      ...current,
      [key]: rawValue === '' ? undefined : Number.parseFloat(rawValue),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cities/${cityId}/inputs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sourceDetail: form.sourceDetail || null,
          notes: form.notes || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Failed to save anchor inputs.');
        return;
      }

      setForm(toForm(data.data as AnchorInputRecord));
      setMessage('Anchor snapshot saved.');
      onSaved();

      const refresh = await fetch(`/api/cities/${cityId}/inputs`);
      const refreshData = await refresh.json();
      setHistory((refreshData.data?.history as AnchorInputRecord[]) || []);
    } catch {
      setMessage('Failed to save anchor inputs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Structured Price Anchors</p>
          <p className="text-xs text-muted-foreground">
            Save the raw AUD anchor prices for {cityName}. The hybrid estimator derives accommodation,
            food, drinks, and activities from these inputs.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save Anchor Snapshot'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Source Type</Label>
          <Select
            value={form.sourceType}
            onValueChange={(value) => setForm((current) => ({ ...current, sourceType: value }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_import">Manual Import</SelectItem>
              <SelectItem value="numbeo_snapshot">Numbeo Snapshot</SelectItem>
              <SelectItem value="official_sites">Official Sites</SelectItem>
              <SelectItem value="peer_fallback">Peer Fallback</SelectItem>
              <SelectItem value="llm">LLM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Confidence</Label>
          <Select
            value={form.confidence}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, confidence: value as EstimateConfidence }))
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Source Detail</Label>
          <Input
            className="h-8 text-xs"
            value={form.sourceDetail}
            onChange={(event) => setForm((current) => ({ ...current, sourceDetail: event.target.value }))}
            placeholder="e.g. Numbeo + metro fares, Apr 2026"
          />
        </div>
      </div>

      {FIELD_GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">{group.title}</h3>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {group.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{field.label}</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="$"
                  value={form[field.key] ?? ''}
                  onChange={(event) => setNumericField(field.key, event.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea
          className="min-h-20 text-xs"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Optional notes about where the anchors came from or any assumptions."
        />
      </div>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Saved Anchor History</p>
          <Badge variant="outline">{history.length} snapshots</Badge>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-2 py-2 text-left font-medium">Captured</th>
                <th className="px-2 py-2 text-left font-medium">Source</th>
                <th className="px-2 py-2 text-left font-medium">Confidence</th>
                <th className="px-2 py-2 text-left font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="px-2 py-2">{entry.capturedAt.slice(0, 10)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span>{entry.sourceType}</span>
                      {entry.isActive ? <Badge variant="secondary">Active</Badge> : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">{entry.confidence || '-'}</td>
                  <td className="px-2 py-2 text-muted-foreground">{entry.sourceDetail || entry.notes || '-'}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                    No anchor snapshots saved yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
