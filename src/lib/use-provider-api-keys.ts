'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CityGenerationProvider } from '@/lib/city-generation-config';
import {
  clearPersistedProviderApiKeys,
  EMPTY_PROVIDER_API_KEYS,
  loadProviderApiKeys,
  persistProviderApiKeyPreference,
  persistProviderApiKeys,
  type ProviderApiKeys,
} from '@/lib/provider-api-key-storage';

export function useProviderApiKeys(storagePrefix: string) {
  const [apiKeys, setApiKeys] = useState<ProviderApiKeys>(() => ({ ...EMPTY_PROVIDER_API_KEYS }));
  const [saveApiKeys, setSaveApiKeys] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = loadProviderApiKeys(window.localStorage, storagePrefix);
    setApiKeys(stored.apiKeys);
    setSaveApiKeys(stored.saveApiKeys);
    setHydrated(true);
  }, [storagePrefix]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;

    persistProviderApiKeyPreference(window.localStorage, storagePrefix, saveApiKeys);
    if (saveApiKeys) {
      persistProviderApiKeys(window.localStorage, storagePrefix, apiKeys);
    } else {
      clearPersistedProviderApiKeys(window.localStorage, storagePrefix);
    }
  }, [apiKeys, hydrated, saveApiKeys, storagePrefix]);

  const updateApiKey = useCallback((provider: CityGenerationProvider, value: string) => {
    setApiKeys((current) => ({
      ...current,
      [provider]: value,
    }));
  }, []);

  const clearCurrentProviderApiKey = useCallback((provider: CityGenerationProvider) => {
    updateApiKey(provider, '');
  }, [updateApiKey]);

  const clearAllSavedApiKeys = useCallback(() => {
    setApiKeys({ ...EMPTY_PROVIDER_API_KEYS });
  }, []);

  const hasAnySavedApiKey = useMemo(
    () => saveApiKeys && Object.values(apiKeys).some((value) => value.trim().length > 0),
    [apiKeys, saveApiKeys]
  );

  return {
    apiKeys,
    saveApiKeys,
    setSaveApiKeys,
    updateApiKey,
    clearCurrentProviderApiKey,
    clearAllSavedApiKeys,
    hasAnySavedApiKey,
  };
}
