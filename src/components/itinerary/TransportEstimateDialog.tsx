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
import {
  CITY_GENERATION_PROVIDER_OPTIONS,
  getDefaultCityGenerationModels,
  migrateStoredCityGenerationModels,
  validateCityGenerationModel,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';
import { useProviderModelDiscovery } from '@/lib/use-provider-model-discovery';
import type {
  IntercityTransportItem,
  TransportEstimateMode,
  TransportEstimateOption,
  TransportEstimateResult,
} from '@/types';

type ProviderOption = CityGenerationProvider;

const STORAGE_PREFIX = 'wanderledger.transport-estimation';

const MODE_OPTIONS: Array<{ value: TransportEstimateMode; label: string }> = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'ferry', label: 'Ferry' },
  { value: 'drive', label: 'Drive' },
  { value: 'rental_car', label: 'Rental car' },
];

interface TransportEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legId: number;
  previousLeg: {
    id: number;
    cityName: string;
    countryName: string;
  } | null;
  currentLeg: {
    cityName: string;
    countryName: string;
    startDate: string | null;
  };
  existingTransports: IntercityTransportItem[];
  onApplyTransports: (transports: IntercityTransportItem[]) => Promise<void> | void;
}

function fmtAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function getDefaultModels() {
  return getDefaultCityGenerationModels();
}

function buildTransportRows(
  option: TransportEstimateOption,
  existingTransports: IntercityTransportItem[],
  replaceExisting: boolean
) {
  const nextCoreRow: IntercityTransportItem = {
    mode: option.transportRowDraft.mode,
    note: option.transportRowDraft.note,
    cost: option.transportRowDraft.cost,
    sortOrder: replaceExisting ? 0 : existingTransports.length,
  };

  if (replaceExisting) {
    return [nextCoreRow];
  }

  return [
    ...existingTransports.map((transport, index) => ({
      ...transport,
      sortOrder: transport.sortOrder ?? index,
    })),
    nextCoreRow,
  ];
}

export function TransportEstimateDialog({
  open,
  onOpenChange,
  legId,
  previousLeg,
  currentLeg,
  existingTransports,
  onApplyTransports,
}: TransportEstimateDialogProps) {
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
  const [loading, setLoading] = useState(false);
  const [applyingMode, setApplyingMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransportEstimateResult | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedProvider = window.localStorage.getItem(`${STORAGE_PREFIX}.provider`) as ProviderOption | null;
    const storedKeys = window.localStorage.getItem(`${STORAGE_PREFIX}.apiKeys`);
    const storedModels = window.localStorage.getItem(`${STORAGE_PREFIX}.models`);

    if (storedProvider && CITY_GENERATION_PROVIDER_OPTIONS.some((option) => option.value === storedProvider)) {
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
        const nextModels = migrateStoredCityGenerationModels(parsed);

        setModels(nextModels);
        window.localStorage.setItem(`${STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
      } catch {
        // Ignore malformed browser storage.
      }
    }
  }, []);

  const selectedProvider = useMemo(
    () => CITY_GENERATION_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? CITY_GENERATION_PROVIDER_OPTIONS[0],
    [provider]
  );
  const activeApiKey = apiKeys[provider] || '';
  const hasAnySavedApiKey = Object.values(apiKeys).some((value) => value.trim().length > 0);
  const activeModel = models[provider] || selectedProvider.defaultModel;
  const modelValidation = validateCityGenerationModel(provider, activeModel);
  const modelListId = `${STORAGE_PREFIX}.${provider}.models`;
  const modelDiscovery = useProviderModelDiscovery({
    provider,
    apiKey: activeApiKey,
    enabled: open,
  });
  const canEstimate = previousLeg != null && Boolean(currentLeg.startDate) && allowedModes.length > 0;

  function handleOpenChange(nextOpen: boolean) {
    if (loading || applyingMode) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
      setResult(null);
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

  function clearCurrentProviderApiKey() {
    updateApiKey('');
    setShowApiKey(false);
  }

  function clearAllSavedApiKeys() {
    const nextKeys = {
      openai: '',
      anthropic: '',
      gemini: '',
    };

    setApiKeys(nextKeys);
    window.localStorage.setItem(`${STORAGE_PREFIX}.apiKeys`, JSON.stringify(nextKeys));
    setShowApiKey(false);
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

  async function handleEstimate() {
    if (!canEstimate) {
      setError(
        previousLeg == null
          ? 'Add a previous leg before estimating transport.'
          : 'Set the destination start date before estimating transport.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/itinerary/legs/${legId}/estimate-transport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: activeApiKey || undefined,
          model: modelValidation.effectiveModel || undefined,
          allowedModes,
          referenceDate: referenceDate || undefined,
          extraContext: extraContext || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to estimate transport.');
      }

      setResult(data.data as TransportEstimateResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate transport.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(option: TransportEstimateOption, replaceExisting: boolean) {
    const nextTransports = buildTransportRows(option, existingTransports, replaceExisting);
    setApplyingMode(`${option.mode}-${replaceExisting ? 'replace' : 'append'}`);
    setError(null);

    try {
      await onApplyTransports(nextTransports);
      onOpenChange(false);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply transport estimate.');
    } finally {
      setApplyingMode(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Estimate Intercity Transport</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">
              {previousLeg ? `${previousLeg.cityName}, ${previousLeg.countryName}` : 'Previous leg required'} to{' '}
              {currentLeg.cityName}, {currentLeg.countryName}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {currentLeg.startDate
                ? `Destination start date: ${currentLeg.startDate}`
                : 'Set the destination start date before estimating transport.'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              The selected provider will use live search or grounding when its API supports it, and will fall back to
              conservative estimation if not. Review the option details before applying them to the plan.
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
                      {CITY_GENERATION_PROVIDER_OPTIONS.map((option) => (
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
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={clearCurrentProviderApiKey} disabled={!activeApiKey}>
                      Clear This Key
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearAllSavedApiKeys} disabled={!hasAnySavedApiKey}>
                      Clear All Saved Keys
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clears browser-stored keys only. Server-side env keys are unchanged.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Model</Label>
                  <Input
                    className="h-9 text-sm"
                    list={modelListId}
                    placeholder={selectedProvider.defaultModel}
                    value={activeModel}
                    onChange={(event) => updateModel(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <datalist id={modelListId}>
                    {modelDiscovery.result.effectiveModels.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">{modelDiscovery.statusMessage}</p>
                  {modelDiscovery.exampleSummary ? (
                    <p className="text-xs text-muted-foreground">
                      Example models: {modelDiscovery.exampleSummary}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {selectedProvider.knownModels.map((model) => (
                      <Button
                        key={model}
                        type="button"
                        variant={modelValidation.effectiveModel === model ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => updateModel(model)}
                      >
                        {model === selectedProvider.defaultModel ? `${model} (default)` : model}
                      </Button>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => void modelDiscovery.refresh()} disabled={modelDiscovery.loading || modelDiscovery.refreshing || loading || applyingMode != null}>
                      <LoadingButtonLabel idle="Refresh models" loading="Refreshing..." isLoading={modelDiscovery.refreshing} />
                    </Button>
                  </div>
                  {modelDiscovery.result.warning ? (
                    <p className="text-xs text-amber-600">{modelDiscovery.result.warning}</p>
                  ) : null}
                  {modelDiscovery.error ? (
                    <p className="text-xs text-amber-600">{modelDiscovery.error}</p>
                  ) : null}
                  <p className={`text-xs ${modelValidation.tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {modelValidation.message}
                  </p>
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

          {loading ? (
            <InlineLoadingState
              title="Estimating route options"
              detail="The server is generating one-way transport options and structuring them into planner-ready rows."
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!loading && result ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{result.options.length} options</Badge>
                {result.providerResult ? (
                  <Badge variant="outline">{result.providerResult.provider}: {result.providerResult.model}</Badge>
                ) : null}
                {result.providerResult?.usedWebSearch ? (
                  <Badge variant="outline">Web search used</Badge>
                ) : null}
                {result.providerResult && !result.providerResult.usedWebSearch && result.providerResult.fallbackReason ? (
                  <Badge variant="outline">Estimated fallback</Badge>
                ) : null}
                {result.providerResult && !result.providerResult.usedWebSearch && !result.providerResult.fallbackReason ? (
                  <Badge variant="outline">Prompt-only estimate</Badge>
                ) : null}
              </div>

              {result.providerResult?.fallbackReason ? (
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  Web search was not used for the final result. Fallback reason: {result.providerResult.fallbackReason}
                </div>
              ) : null}

              {result.providerResult?.searchQueries.length ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-foreground">Search queries used</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {result.providerResult.searchQueries.map((query) => (
                      <li key={query}>{query}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.evidenceSummary.routeFacts.length > 0 ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-foreground">Route facts passed to the model</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {result.evidenceSummary.routeFacts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.providerResult?.citations.length ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-foreground">Sources consulted</p>
                  <div className="mt-2 flex flex-col gap-1 text-xs">
                    {result.providerResult.citations.map((citation) => (
                      <a
                        key={`${citation.url}-${citation.title || 'untitled'}`}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {citation.title || citation.url}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {result.options.length === 0 ? (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  No options were returned for this route. Try a different model, fewer modes, or extra context.
                </div>
              ) : (
                <div className="space-y-3">
                  {result.options.map((option) => {
                    const appendKey = `${option.mode}-append`;
                    const replaceKey = `${option.mode}-replace`;
                    return (
                      <div key={option.mode} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{option.label}</span>
                              <Badge variant="outline" className="capitalize">
                                {option.confidence}
                              </Badge>
                              <Badge variant="outline">{fmtAud(option.totalAud)}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{option.sourceBasis}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleApply(option, false)}
                              disabled={applyingMode !== null}
                            >
                              <LoadingButtonLabel
                                idle={existingTransports.length > 0 ? 'Add As Extra Row' : 'Apply'}
                                loading="Applying..."
                                isLoading={applyingMode === appendKey}
                              />
                            </Button>
                            {existingTransports.length > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleApply(option, true)}
                                disabled={applyingMode !== null}
                              >
                                <LoadingButtonLabel
                                  idle="Replace Existing"
                                  loading="Replacing..."
                                  isLoading={applyingMode === replaceKey}
                                />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-2 text-sm text-foreground">{option.notes}</p>
                        {option.reasons.length > 0 ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Reasons: {option.reasons.join(' | ')}
                          </div>
                        ) : null}
                        {option.appliedAssumptions.length > 0 ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Assumptions: {option.appliedAssumptions.join(' | ')}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={loading || applyingMode != null}
            >
              Close
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleEstimate}
              disabled={loading || applyingMode != null || !canEstimate}
            >
              <LoadingButtonLabel idle="Estimate Options" loading="Estimating..." isLoading={loading} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
