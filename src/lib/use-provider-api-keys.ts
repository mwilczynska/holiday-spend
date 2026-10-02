'use client';

import { useSyncExternalStore } from 'react';
import { SHARED_PROVIDER_API_KEY_STORAGE_KEY } from '@/lib/provider-api-key-storage';
import { createProviderApiKeyStore, EMPTY_PROVIDER_API_KEY_STATE } from '@/lib/provider-api-key-store';

const sharedKeys = createProviderApiKeyStore({
  getStorage: () => {
    try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
  },
  listenForStorage: (refresh) => {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === null || event.key === SHARED_PROVIDER_API_KEY_STORAGE_KEY)) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
});

export function useProviderApiKeys() {
  const state = useSyncExternalStore(sharedKeys.subscribe, sharedKeys.getSnapshot, () => EMPTY_PROVIDER_API_KEY_STATE);
  return {
    ...state,
    setSaveApiKeys: sharedKeys.setSaveApiKeys,
    updateApiKey: sharedKeys.updateApiKey,
    clearCurrentProviderApiKey: sharedKeys.clearCurrentProviderApiKey,
    clearAllSavedApiKeys: sharedKeys.clearAllSavedApiKeys,
    hasAnySavedApiKey: state.saveApiKeys && Object.values(state.apiKeys).some((value) => value.trim().length > 0),
  };
}
