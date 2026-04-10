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
import { CITY_GENERATION_DEFAULT_MODELS } from '@/lib/city-generation-config';

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
  payload: {
    confidence: string;
    confidence_notes: string;
    anchors_usd: Record<string, number>;
    tiers_aud: Record<string, number>;
  };
}

type ProviderOption = 'anthropic' | 'openai' | 'gemini';
type ProviderConfig = {
  label: string;
  help: string;
  defaultModel: string;
};

const STORAGE_PREFIX = 'wanderledger.city-generation';
const LEGACY_DEFAULT_MODEL_MIGRATIONS: Record<ProviderOption, string[]> = {
  openai: ['gpt-4o', 'gpt-5-mini'],
  anthropic: ['claude-sonnet-4-20250514'],
  gemini: ['gemini-2.0-flash'],
};

const PROVIDER_OPTIONS: Array<{ value: ProviderOption } & ProviderConfig> = [
  {
    value: 'openai',
    label: 'OpenAI',
    help: 'Uses your OpenAI API key or the server OPENAI_API_KEY.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.openai,
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    help: 'Uses your Anthropic API key or the server ANTHROPIC_API_KEY.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.anthropic,
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    help: 'Uses your Gemini API key or the server GEMINI_API_KEY.',
    defaultModel: CITY_GENERATION_DEFAULT_MODELS.gemini,
  },
];

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
  const [models, setModels] = useState<Record<ProviderOption, string>>({
    openai: CITY_GENERATION_DEFAULT_MODELS.openai,
    anthropic: CITY_GENERATION_DEFAULT_MODELS.anthropic,
    gemini: CITY_GENERATION_DEFAULT_MODELS.gemini,
  });
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
        // Ignore malformed browser storage and keep the default state.
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
        // Ignore malformed browser storage and keep the default state.
      }
    }
  }, []);

  const selectedProvider = PROVIDER_OPTIONS.find((option) => option.value === provider) ?? PROVIDER_OPTIONS[0];
  const activeApiKey = apiKeys[provider] || '';
  const activeModel = models[provider] || selectedProvider.defaultModel;

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
          model: activeModel || undefined,
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
          Runs the new-city methodology prompt on the server for {cityName}, {countryName}, then saves
          the generated AUD tier outputs plus anchor provenance into estimate history. API keys entered
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
          <div className="flex items-center gap-2">
            <Switch checked={showApiKey} onCheckedChange={setShowApiKey} />
            <Label className="text-xs text-muted-foreground">Show API key</Label>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
          <p className="text-xs text-muted-foreground">
            Provider model id. Default for {selectedProvider.label}: {selectedProvider.defaultModel}
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

          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">USD Anchors</summary>
            <div className="grid gap-2 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(result.payload.anchors_usd).map(([key, value]) => (
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
              {Object.entries(result.payload.tiers_aud).map(([key, value]) => (
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
