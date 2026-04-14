'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineLoadingState, LoadingButtonLabel } from '@/components/ui/loading-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CITY_GENERATION_DEFAULT_MODELS } from '@/lib/city-generation-config';
import type { IntercityTransportItem, TransportEstimateMode, TransportEstimateResult } from '@/types';

type ProviderOption = 'anthropic' | 'openai' | 'gemini';

const STORAGE_PREFIX = 'wanderledger.transport-estimation';
const LEGACY_DEFAULT_MODEL_MIGRATIONS: Record<ProviderOption, string[]> = {
  openai: ['gpt-4o', 'gpt-5-mini'],
  anthropic: ['claude-sonnet-4-20250514'],
  gemini: ['gemini-2.0-flash'],
};

const PROVIDER_OPTIONS: Array<{
  value: ProviderOption;
  label: string;
  help: string;
  defaultModel: string;
}> = [
  {
    value: 'openai',
    label: 'OpenAI',
    help: 'Uses OpenAI web search when the selected model/runtime supports it, then falls back to estimation.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.openai,
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    help: 'Uses Anthropic web search when the selected model/runtime supports it, then falls back to estimation.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.anthropic,
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    help: 'Uses Google Search grounding when the selected model/runtime supports it, then falls back to estimation.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.gemini,
  },
];

const MODE_OPTIONS: Array<{ value: TransportEstimateMode; label: string }> = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'ferry', label: 'Ferry' },
  { value: 'drive', label: 'Drive' },
  { value: 'rental_car', label: 'Rental car' },
];

interface BulkTransportEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legs: Array<{
    id: number;
    cityName: string;
    countryName: string;
    startDate: string | null;
    intercityTransports: IntercityTransportItem[];
  }>;
  onApplied?: (appliedCount: number) => Promise<void> | void;
}

interface MissingTransportLeg {
  legId: number;
  origin: string;
  destination: string;
  travelDate: string;
}

interface EstimatedLegResult {
  legId: number;
  origin: string;
  destination: string;
  travelDate: string;
  status: 'success' | 'error';
  estimate?: TransportEstimateResult;
  error?: string;
}

const BULK_ESTIMATE_DELAY_MS: Record<ProviderOption, number> = {
  anthropic: 3500,
  openai: 750,
  gemini: 2000,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDefaultModels() {
  return {
    openai: CITY_GENERATION_DEFAULT_MODELS.openai,
    anthropic: CITY_GENERATION_DEFAULT_MODELS.anthropic,
    gemini: CITY_GENERATION_DEFAULT_MODELS.gemini,
  };
}

function fmtAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function buildMissingTransportLegs(
  legs: BulkTransportEstimateDialogProps['legs']
): MissingTransportLeg[] {
  return legs.flatMap((leg, index) => {
    if (index === 0) return [];
    if (!leg.startDate) return [];
    if ((leg.intercityTransports || []).length > 0) return [];

    const previousLeg = legs[index - 1];
    return [{
      legId: leg.id,
      origin: `${previousLeg.cityName}, ${previousLeg.countryName}`,
      destination: `${leg.cityName}, ${leg.countryName}`,
      travelDate: leg.startDate,
    }];
  });
}

export function BulkTransportEstimateDialog({
  open,
  onOpenChange,
  legs,
  onApplied,
}: BulkTransportEstimateDialogProps) {
  const [provider, setProvider] = useState<ProviderOption>('openai');
  const [apiKeys, setApiKeys] = useState<Record<ProviderOption, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [models, setModels] = useState<Record<ProviderOption, string>>(getDefaultModels());
  const [allowedModes, setAllowedModes] = useState<TransportEstimateMode[]>([
    'flight',
    'train',
    'bus',
    'ferry',
    'drive',
  ]);
  const [referenceDate, setReferenceDate] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EstimatedLegResult[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedProvider = window.localStorage.getItem(`${STORAGE_PREFIX}.provider`) as ProviderOption | null;
    const storedKeys = window.localStorage.getItem(`${STORAGE_PREFIX}.apiKeys`);
    const storedModels = window.localStorage.getItem(`${STORAGE_PREFIX}.models`);

    if (storedProvider && PROVIDER_OPTIONS.some((option) => option.value === storedProvider)) {
      setProvider(storedProvider);
    }

    if (storedKeys) {
      try {
        const parsed = JSON.parse(storedKeys) as Partial<Record<ProviderOption, string>>;
        setApiKeys({
          openai: parsed.openai || '',
          anthropic: parsed.anthropic || '',
          gemini: parsed.gemini || '',
        });
      } catch {
        // Ignore malformed browser storage.
      }
    }

    if (storedModels) {
      try {
        const parsed = JSON.parse(storedModels) as Partial<Record<ProviderOption, string>>;
        const nextModels = {
          openai:
            parsed.openai && !LEGACY_DEFAULT_MODEL_MIGRATIONS.openai.includes(parsed.openai)
              ? parsed.openai
              : CITY_GENERATION_DEFAULT_MODELS.openai,
          anthropic:
            parsed.anthropic && !LEGACY_DEFAULT_MODEL_MIGRATIONS.anthropic.includes(parsed.anthropic)
              ? parsed.anthropic
              : CITY_GENERATION_DEFAULT_MODELS.anthropic,
          gemini:
            parsed.gemini && !LEGACY_DEFAULT_MODEL_MIGRATIONS.gemini.includes(parsed.gemini)
              ? parsed.gemini
              : CITY_GENERATION_DEFAULT_MODELS.gemini,
        };

        setModels(nextModels);
        window.localStorage.setItem(`${STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
      } catch {
        // Ignore malformed browser storage.
      }
    }
  }, []);

  const selectedProvider = useMemo(
    () => PROVIDER_OPTIONS.find((option) => option.value === provider) ?? PROVIDER_OPTIONS[0],
    [provider]
  );
  const activeApiKey = apiKeys[provider] || '';
  const activeModel = models[provider] || selectedProvider.defaultModel;
  const missingTransportLegs = useMemo(() => buildMissingTransportLegs(legs), [legs]);
  const successfulResults = results.filter(
    (result): result is EstimatedLegResult & { estimate: TransportEstimateResult } =>
      result.status === 'success' && result.estimate != null && result.estimate.options.length > 0
  );

  function handleOpenChange(nextOpen: boolean) {
    if (estimating || applying) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
      setResults([]);
    }
  }

  function updateProvider(nextProvider: ProviderOption) {
    setProvider(nextProvider);
    window.localStorage.setItem(`${STORAGE_PREFIX}.provider`, nextProvider);
  }

  function updateApiKey(value: string) {
    const nextKeys = {
      ...apiKeys,
      [provider]: value,
    };
    setApiKeys(nextKeys);
    window.localStorage.setItem(`${STORAGE_PREFIX}.apiKeys`, JSON.stringify(nextKeys));
  }

  function updateModel(value: string) {
    const nextModels = {
      ...models,
      [provider]: value,
    };
    setModels(nextModels);
    window.localStorage.setItem(`${STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
  }

  function toggleMode(mode: TransportEstimateMode) {
    setAllowedModes((current) => (
      current.includes(mode) ? current.filter((entry) => entry !== mode) : [...current, mode]
    ));
  }

  async function handleEstimateAll() {
    if (missingTransportLegs.length === 0) {
      setError('There are no missing intercity transport legs to estimate.');
      return;
    }

    if (allowedModes.length === 0) {
      setError('Select at least one transport mode.');
      return;
    }

    setEstimating(true);
    setError(null);
    setResults([]);

    const nextResults: EstimatedLegResult[] = [];

    for (const leg of missingTransportLegs) {
      try {
        const response = await fetch(`/api/itinerary/legs/${leg.legId}/estimate-transport`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey: activeApiKey || undefined,
            model: activeModel || undefined,
            allowedModes,
            referenceDate: referenceDate || undefined,
            extraContext: extraContext || undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to estimate ${leg.destination}.`);
        }

        nextResults.push({
          legId: leg.legId,
          origin: leg.origin,
          destination: leg.destination,
          travelDate: leg.travelDate,
          status: 'success',
          estimate: data.data as TransportEstimateResult,
        });
      } catch (err) {
        nextResults.push({
          legId: leg.legId,
          origin: leg.origin,
          destination: leg.destination,
          travelDate: leg.travelDate,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to estimate transport for this leg.',
        });
      }

      setResults([...nextResults]);

      if (leg.legId !== missingTransportLegs[missingTransportLegs.length - 1]?.legId) {
        await sleep(BULK_ESTIMATE_DELAY_MS[provider]);
      }
    }

    setEstimating(false);
  }

  async function handleApplyAll() {
    if (successfulResults.length === 0) {
      setError('No successful estimates are ready to apply.');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      for (const result of successfulResults) {
        const topOption = result.estimate.options[0];
        const payload: IntercityTransportItem[] = [{
          mode: topOption.transportRowDraft.mode,
          note: topOption.transportRowDraft.note,
          cost: topOption.transportRowDraft.cost,
          sortOrder: 0,
        }];

        const response = await fetch(`/api/itinerary/legs/${result.legId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intercityTransports: payload }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to apply transport for ${result.destination}.`);
        }
      }

      await onApplied?.(successfulResults.length);
      onOpenChange(false);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply bulk transport estimates.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Estimate Missing Intercity Transport</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">
              {missingTransportLegs.length} missing intercity transport {missingTransportLegs.length === 1 ? 'leg' : 'legs'} found
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              This bulk action only targets legs that already have a previous leg, already have a start date, and do not yet have any intercity transport rows.
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Applying uses the top returned option for each successful leg.
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Modes</Label>
            <div className="flex flex-wrap gap-2">
              {MODE_OPTIONS.map((mode) => {
                const selected = allowedModes.includes(mode.value);
                return (
                  <label
                    key={mode.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      selected ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleMode(mode.value)} />
                    <span>{mode.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <details className="rounded-md border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Advanced estimation settings</summary>
            <div className="space-y-4 border-t px-3 py-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Provider</Label>
                  <Select value={provider} onValueChange={(value) => updateProvider(value as ProviderOption)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{selectedProvider.help}</p>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{selectedProvider.label} API Key</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Optional. Leave blank to use a server-side key if configured."
                      type={showApiKey ? 'text' : 'password'}
                      value={activeApiKey}
                      onChange={(event) => updateApiKey(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showApiKey}
                      onChange={(event) => setShowApiKey(event.target.checked)}
                    />
                    Show API key
                  </label>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Model</Label>
                  <Input
                    className="h-9 text-sm"
                    placeholder={selectedProvider.defaultModel}
                    value={activeModel}
                    onChange={(event) => updateModel(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Reference Date Or Booking Context</Label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="e.g. booked 3 weeks ahead in shoulder season"
                    value={referenceDate}
                    onChange={(event) => setReferenceDate(event.target.value)}
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Extra Context</Label>
                  <Textarea
                    className="min-h-20 text-sm"
                    placeholder="Optional notes such as baggage, preferred mode, scenic route preference, or flexibility."
                    value={extraContext}
                    onChange={(event) => setExtraContext(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          {estimating ? (
            <InlineLoadingState
              title="Estimating missing transport legs"
              detail="The planner is working through missing route legs sequentially so each estimate uses the same provider settings."
            />
          ) : null}

          {applying ? (
            <InlineLoadingState
              title="Applying estimated transport rows"
              detail="The planner is saving the top estimated option into each successful leg."
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{successfulResults.length} ready to apply</Badge>
                <Badge variant="outline">
                  {results.filter((result) => result.status === 'error').length} failed
                </Badge>
              </div>

              <div className="space-y-3">
                {results.map((result) => {
                  const topOption = result.estimate?.options[0];
                  return (
                    <div key={result.legId} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{result.origin} to {result.destination}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{result.travelDate}</div>
                        </div>
                        <Badge variant="outline">
                          {result.status === 'success' ? 'Estimated' : 'Failed'}
                        </Badge>
                      </div>

                      {result.status === 'error' ? (
                        <p className="mt-2 text-sm text-destructive">{result.error}</p>
                      ) : topOption ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{topOption.label}</span>
                            <Badge variant="outline" className="capitalize">{topOption.confidence}</Badge>
                            <Badge variant="outline">{fmtAud(topOption.totalAud)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{topOption.sourceBasis}</p>
                          <p className="text-sm text-foreground">{topOption.notes}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No option was returned for this leg.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={estimating || applying}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleEstimateAll}
              disabled={estimating || applying || missingTransportLegs.length === 0 || allowedModes.length === 0}
            >
              <LoadingButtonLabel idle="Estimate Missing Legs" loading="Estimating..." isLoading={estimating} />
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleApplyAll}
              disabled={estimating || applying || successfulResults.length === 0}
            >
              <LoadingButtonLabel idle="Apply Top Options" loading="Applying..." isLoading={applying} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
