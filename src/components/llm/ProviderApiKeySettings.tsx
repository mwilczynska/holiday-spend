'use client';

import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LLM_PROVIDER_IDS, LLM_PROVIDER_SPECS } from '@/lib/llm-provider-registry';
import { useProviderApiKeys } from '@/lib/use-provider-api-keys';

/**
 * Every provider's key in one place. Keys use the same browser store as the generation and
 * transport dialogs: kept for this window's session, and saved in this browser only when the
 * opt-in is checked. They are never written to the database.
 */
export function ProviderApiKeySettings() {
  const idPrefix = useId();
  const {
    apiKeys,
    saveApiKeys,
    setSaveApiKeys,
    updateApiKey,
    clearCurrentProviderApiKey,
    clearAllSavedApiKeys,
    hasAnySavedApiKey,
  } = useProviderApiKeys();
  const [visible, setVisible] = useState<Partial<Record<string, boolean>>>({});
  const keyCount = LLM_PROVIDER_IDS.filter((provider) => apiKeys[provider].trim()).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider API Keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Keys entered here are shared with the city generation and transport estimate dialogs. They stay in this
          browser and are sent to this app&apos;s server only with a request to that provider. They are never saved to
          the database. Without the option below, keys last until this window is reloaded.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={saveApiKeys}
              onChange={(event) => setSaveApiKeys(event.target.checked)}
            />
            Save API keys in this browser
          </label>
          <Button data-analytics="provider-api-key-settings.clear-all" type="button" variant="outline" size="sm" onClick={clearAllSavedApiKeys} disabled={keyCount === 0}>
            Clear all keys
          </Button>
          <span role="status" className="text-sm text-muted-foreground">
            {keyCount === 0
              ? 'No keys entered.'
              : `${keyCount} ${keyCount === 1 ? 'key' : 'keys'} ${hasAnySavedApiKey ? 'saved in this browser' : 'held for this session only'}.`}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {LLM_PROVIDER_IDS.map((provider) => {
            const spec = LLM_PROVIDER_SPECS[provider];
            const inputId = `${idPrefix}-${provider}`;
            const value = apiKeys[provider];
            const shown = visible[provider] === true;
            return (
              <div key={provider} className="space-y-1.5 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={inputId}>{spec.label}</Label>
                  <Badge variant={spec.webSearch ? 'secondary' : 'outline'}>
                    {spec.webSearch ? 'Web search' : 'No web search'}
                  </Badge>
                </div>
                <Input
                  id={inputId}
                  className="h-9 text-sm"
                  type={shown ? 'text' : 'password'}
                  value={value}
                  placeholder={`${spec.label} API key`}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => updateApiKey(provider, event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={shown}
                      onChange={(event) => setVisible((current) => ({ ...current, [provider]: event.target.checked }))}
                    />
                    Show
                  </label>
                  <Button data-analytics="provider-api-key-settings.clear" type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => clearCurrentProviderApiKey(provider)} disabled={!value}>
                    Clear
                  </Button>
                  <a href={spec.keyUrl} target="_blank" rel="noreferrer" className="underline">
                    Get a key
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
