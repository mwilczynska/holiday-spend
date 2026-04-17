'use client';

import { useEffect, useState } from 'react';
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

const STORAGE_PREFIX = 'wanderledger.city-generation';

type ProviderOption = CityGenerationProvider;

interface PlannerNewCityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (payload: {
    city: {
      cityName: string;
      countryName: string;
      createdCountry: boolean;
      createdCity: boolean;
      generatedCity: boolean;
      reusedExistingCity: boolean;
    };
    requested: {
      cityName: string;
      countryName: string;
      nights: number;
    };
  }) => Promise<void> | void;
}

function getDefaultModels() {
  return getDefaultCityGenerationModels();
}

export function PlannerNewCityDialog({ open, onOpenChange, onCreated }: PlannerNewCityDialogProps) {
  const [cityName, setCityName] = useState('');
  const [countryName, setCountryName] = useState('');
  const [nights, setNights] = useState('7');
  const [provider, setProvider] = useState<ProviderOption>('openai');
  const [apiKeys, setApiKeys] = useState<Record<ProviderOption, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [models, setModels] = useState<Record<ProviderOption, string>>(getDefaultModels());
  const [referenceDate, setReferenceDate] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Ignore malformed browser storage and keep defaults.
      }
    }

    if (storedModels) {
      try {
        const parsed = JSON.parse(storedModels) as Partial<Record<ProviderOption, string>>;
        const nextModels = migrateStoredCityGenerationModels(parsed);

        setModels(nextModels);
        window.localStorage.setItem(`${STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
      } catch {
        // Ignore malformed browser storage and keep defaults.
      }
    }
  }, []);

  const selectedProvider =
    CITY_GENERATION_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? CITY_GENERATION_PROVIDER_OPTIONS[0];
  const activeApiKey = apiKeys[provider] || '';
  const activeModel = models[provider] || selectedProvider.defaultModel;
  const modelValidation = validateCityGenerationModel(provider, activeModel);
  const modelListId = `${STORAGE_PREFIX}.${provider}.models`;

  function resetForm() {
    setCityName('');
    setCountryName('');
    setNights('7');
    setReferenceDate('');
    setExtraContext('');
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (loading) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
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

  async function handleSubmit() {
    const parsedNights = Number.parseInt(nights, 10);
    if (!Number.isInteger(parsedNights) || parsedNights < 1) {
      setError('Enter a valid number of nights before adding the leg.');
      return;
    }

    if (!cityName.trim() || !countryName.trim()) {
      setError('Enter both the city name and country name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requested = {
        cityName: cityName.trim(),
        countryName: countryName.trim(),
        nights: parsedNights,
      };

      const response = await fetch('/api/itinerary/legs/create-with-city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requested,
          provider,
          apiKey: activeApiKey || undefined,
          model: modelValidation.effectiveModel || undefined,
          referenceDate: referenceDate || undefined,
          extraContext: extraContext || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create the city and add the leg.');
      }

      onOpenChange(false);
      resetForm();
      await onCreated({
        city: data.data?.city,
        requested,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the city and add the leg.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New City With LLM</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Enter only the city name and country name. The server will check the current library first.</p>
            <p>
              If the city is missing, it will infer the IDs, country currency, region, and city-cost data before the leg is
              added.
            </p>
          </div>

          <div>
            <Label>City Name</Label>
            <Input
              value={cityName}
              onChange={(event) => setCityName(event.target.value)}
              placeholder="e.g. Kunming"
            />
          </div>

          <div>
            <Label>Country Name</Label>
            <Input
              value={countryName}
              onChange={(event) => setCountryName(event.target.value)}
              placeholder="e.g. China"
            />
          </div>

          <div>
            <Label>Nights</Label>
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={nights}
              onChange={(event) => setNights(event.target.value)}
            />
          </div>

          <details className="rounded-md border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              Advanced generation settings
            </summary>
            <div className="space-y-4 border-t px-3 py-3">
              <p className="text-xs text-muted-foreground">
                Optional. Leave these alone to use your saved provider defaults or the server-side key if one is configured.
              </p>

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
                    {selectedProvider.knownModels.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    Suggested models: {selectedProvider.knownModels.join(', ')}
                  </p>
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
                  </div>
                  <p className={`text-xs ${modelValidation.tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {modelValidation.message}
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
                    placeholder="Optional notes such as neighborhoods, trip style, or caveats."
                    value={extraContext}
                    onChange={(event) => setExtraContext(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          {loading ? (
            <InlineLoadingState
              title="Resolving city details and adding the leg"
              detail="The server is checking the current library, inferring metadata, generating city costs if needed, and creating the new itinerary leg."
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSubmit}
              disabled={
                loading ||
                !cityName.trim() ||
                !countryName.trim() ||
                !Number.isInteger(Number.parseInt(nights, 10)) ||
                Number.parseInt(nights, 10) < 1
              }
            >
              <LoadingButtonLabel
                idle="Generate City And Add Leg"
                loading="Generating And Adding..."
                isLoading={loading}
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
