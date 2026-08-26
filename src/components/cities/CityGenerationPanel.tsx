'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineLoadingState, LoadingButtonLabel } from '@/components/ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  CITY_GENERATION_PROVIDER_OPTIONS,
  CITY_GENERATION_DEFAULT_REASONING_EFFORT,
  CITY_GENERATION_REASONING_EFFORT_LABELS,
  getSupportedCityGenerationReasoningEfforts,
  getDefaultCityGenerationModels,
  migrateStoredCityGenerationModels,
  validateCityGenerationModel,
  type CityGenerationProvider,
  type CityGenerationReasoningEffort,
} from '@/lib/city-generation-config';
import { useProviderModelDiscovery } from '@/lib/use-provider-model-discovery';

interface CityGenerationPanelProps {
  cityId: string;
  cityName: string;
  countryName: string;
  onGenerated: () => void;
}

interface GenerationResult {
  provider: string;
  model: string;
  promptVersion: string;
  methodologyVersion: string;
  reasoningEffort?: CityGenerationReasoningEffort;
  inferredAudPerUsd: number | null;
  formulaVersion?: string | null;
  fx?: { snapshotId?: string; audPerUsd?: number } | null;
  anchorsAud?: Record<string, number>;
  tiersAud?: Record<string, number>;
  payload: {
    confidence: string;
    confidence_notes: string;
    comparable_city_reasoning?: string;
    anchors_usd?: Record<string, number>;
    tiers_aud?: Record<string, number>;
  };
}

type ProviderOption = CityGenerationProvider;

const STORAGE_PREFIX = 'holiday-spend.city-generation';

const fmtMoney = (value: number) => value.toFixed(2);

export function CityGenerationPanel({
  cityId,
  cityName,
  countryName,
  onGenerated,
}: CityGenerationPanelProps) {
  const [provider, setProvider] = useState<ProviderOption>('openai');
  const [apiKeys, setApiKeys] = useState<Record<ProviderOption, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [models, setModels] = useState<Record<ProviderOption, string>>(getDefaultCityGenerationModels());
  const [reasoningEffort, setReasoningEffort] = useState<CityGenerationReasoningEffort>(
    CITY_GENERATION_DEFAULT_REASONING_EFFORT
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [referenceDate, setReferenceDate] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  useEffect(() => {
    const storedProvider = window.localStorage.getItem(`${STORAGE_PREFIX}.provider`) as ProviderOption | null;
    const storedKeys = window.localStorage.getItem(`${STORAGE_PREFIX}.apiKeys`);
    const storedModels = window.localStorage.getItem(`${STORAGE_PREFIX}.models`);
    const storedReasoningEffort = window.localStorage.getItem(`${STORAGE_PREFIX}.reasoningEffort`);

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
        // Ignore malformed browser storage and keep the default state.
      }
    }

    if (storedModels) {
      try {
        const parsed = JSON.parse(storedModels) as Partial<Record<ProviderOption, string>>;
        const nextModels = migrateStoredCityGenerationModels(parsed);

        setModels(nextModels);
        window.localStorage.setItem(`${STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
      } catch {
        // Ignore malformed browser storage and keep the default state.
      }
    }

    if (storedReasoningEffort && CITY_GENERATION_REASONING_EFFORT_LABELS[storedReasoningEffort as CityGenerationReasoningEffort]) {
      setReasoningEffort(storedReasoningEffort as CityGenerationReasoningEffort);
    }
  }, []);

  const selectedProvider =
    CITY_GENERATION_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? CITY_GENERATION_PROVIDER_OPTIONS[0];
  const activeApiKey = apiKeys[provider] || '';
  const hasAnySavedApiKey = Object.values(apiKeys).some((value) => value.trim().length > 0);
  const activeModel = models[provider] || selectedProvider.defaultModel;
  const modelListId = `${STORAGE_PREFIX}.${provider}.models`;
  const modelDiscovery = useProviderModelDiscovery({
    provider,
    apiKey: activeApiKey,
    enabled: true,
  });
  const modelValidation = validateCityGenerationModel(provider, activeModel, modelDiscovery.result.effectiveModels);
  const supportedReasoningEfforts = getSupportedCityGenerationReasoningEfforts(provider, activeModel);
  const effectiveReasoningEffort = supportedReasoningEfforts.includes(reasoningEffort)
    ? reasoningEffort
    : supportedReasoningEfforts.includes(CITY_GENERATION_DEFAULT_REASONING_EFFORT)
      ? CITY_GENERATION_DEFAULT_REASONING_EFFORT
      : 'none';

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

  function updateReasoningEffort(value: CityGenerationReasoningEffort) {
    setReasoningEffort(value);
    window.localStorage.setItem(`${STORAGE_PREFIX}.reasoningEffort`, value);
  }

  async function refreshModelsAndResetDefault() {
    await modelDiscovery.refresh();
    updateModel(selectedProvider.defaultModel);
    updateReasoningEffort(CITY_GENERATION_DEFAULT_REASONING_EFFORT);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cities/${cityId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: activeApiKey || undefined,
          model: modelValidation.effectiveModel || undefined,
          reasoningEffort: effectiveReasoningEffort,
          referenceDate: referenceDate || undefined,
          extraContext: extraContext || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to generate city costs.');
        return;
      }

      setResult(data.data as GenerationResult);
      onGenerated();
    } catch {
      setError('Failed to generate city costs.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Generate Or Update With LLM</p>
        <p className="text-xs text-muted-foreground">
          Runs the selected city-cost methodology prompt on the server for {cityName}, {countryName}, then saves
          deterministic AUD tier outputs plus anchor provenance into estimate history. API keys entered
          here stay in this browser only and are not stored in the database.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Provider</Label>
          <Select value={provider} onValueChange={(value) => updateProvider(value as ProviderOption)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select provider" />
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
          <div className="flex items-center gap-2">
            <Switch checked={showApiKey} onCheckedChange={setShowApiKey} />
            <Label className="text-xs text-muted-foreground">Show API key</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearCurrentProviderApiKey} disabled={!activeApiKey}>
              Clear This Key
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAllSavedApiKeys} disabled={!hasAnySavedApiKey}>
              Clear All Saved Keys
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Clears browser-stored keys only. Server-side env keys are unchanged.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {modelDiscovery.result.effectiveModels.slice(0, 16).map((model) => (
              <Button
                key={model}
                type="button"
                variant={modelValidation.effectiveModel === model ? 'secondary' : 'outline'}
                size="sm"
                className="h-auto min-h-9 whitespace-normal break-words px-2 py-1.5 text-xs"
                onClick={() => updateModel(model)}
              >
                {model === selectedProvider.defaultModel ? `${model} (default)` : model}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" className="col-span-2 sm:col-span-4" onClick={() => void refreshModelsAndResetDefault()} disabled={modelDiscovery.loading || modelDiscovery.refreshing}>
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
          <Label className="text-xs">Thinking / reasoning effort</Label>
          <Select
            value={effectiveReasoningEffort}
            onValueChange={(value) => updateReasoningEffort(value as CityGenerationReasoningEffort)}
            disabled={supportedReasoningEfforts.length <= 1}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select effort" />
            </SelectTrigger>
            <SelectContent>
              {supportedReasoningEfforts.map((effort) => (
                <SelectItem key={effort} value={effort}>
                  {CITY_GENERATION_REASONING_EFFORT_LABELS[effort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {supportedReasoningEfforts.length > 1
              ? 'Passed to the selected provider when supported. Higher effort can increase latency and cost.'
              : 'The selected model does not expose a configurable thinking setting through this adapter.'}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reference Date Or Season</Label>
          <Input
            className="h-9 text-sm"
            placeholder="e.g. April 2026 shoulder season"
            value={referenceDate}
            onChange={(event) => setReferenceDate(event.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Extra Context</Label>
          <Textarea
            className="min-h-20 text-sm"
            placeholder="Optional notes such as specific neighborhoods, trip style, or special conditions."
            value={extraContext}
            onChange={(event) => setExtraContext(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleGenerate} disabled={loading}>
          <LoadingButtonLabel
            idle="Generate City Costs"
            loading="Generating..."
            isLoading={loading}
          />
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {loading ? (
        <InlineLoadingState
          title={`Generating planner costs for ${cityName}, ${countryName}`}
          detail="The server is running the methodology prompt, validating the output, and saving the new city estimate history."
        />
      ) : null}

      {result ? (
        <div className="space-y-4 rounded-md border bg-background/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{result.provider}</Badge>
            <Badge variant="outline">{result.model}</Badge>
            <Badge variant="outline">{result.promptVersion}</Badge>
            <Badge variant="outline">Method {result.methodologyVersion}</Badge>
            {result.reasoningEffort ? <Badge variant="outline">Thinking {result.reasoningEffort}</Badge> : null}
            {typeof result.inferredAudPerUsd === 'number' ? (
              <Badge variant="outline">1 USD = {fmtMoney(result.inferredAudPerUsd)} AUD</Badge>
            ) : null}
            <Badge
              variant={
                result.payload.confidence === 'high'
                  ? 'default'
                  : result.payload.confidence === 'medium'
                    ? 'secondary'
                    : 'outline'
              }
            >
              Confidence: {result.payload.confidence}
            </Badge>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Confidence Notes</p>
            <p className="text-sm text-muted-foreground">{result.payload.confidence_notes}</p>
          </div>

          {result.payload.comparable_city_reasoning ? (
            <p className="text-sm text-muted-foreground">{result.payload.comparable_city_reasoning}</p>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Implied AUD/USD Rate</p>
            <p className="text-sm text-muted-foreground">
              {result.fx?.snapshotId
                ? `Server FX snapshot ${result.fx.snapshotId}${result.fx.audPerUsd ? `: 1 USD = ${fmtMoney(result.fx.audPerUsd)} AUD.` : '.'}`
                : typeof result.inferredAudPerUsd === 'number'
                  ? `The legacy generated tier basket implies 1 USD = ${fmtMoney(result.inferredAudPerUsd)} AUD.`
                  : 'No exchange-rate provenance was returned.'}
            </p>
          </div>

          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">USD Anchors</summary>
            <div className="grid gap-2 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(result.payload.anchors_usd ?? {}).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{key}</div>
                  <div className="text-sm font-medium">{fmtMoney(value)}</div>
                </div>
              ))}
            </div>
          </details>

          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">AUD Tier Outputs</summary>
            <div className="grid gap-2 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(result.tiersAud ?? result.payload.tiers_aud ?? {}).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{key}</div>
                  <div className="text-sm font-medium">{fmtMoney(value)}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
