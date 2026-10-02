import type { CityGenerationProvider } from '@/lib/city-generation-config';
import {
  EMPTY_PROVIDER_API_KEYS,
  SHARED_PROVIDER_API_KEY_STORAGE_KEY,
  loadSharedProviderApiKeys,
  persistSharedProviderApiKeys,
  type ProviderApiKeyState,
  type StorageLike,
} from '@/lib/provider-api-key-storage';

export const EMPTY_PROVIDER_API_KEY_STATE: ProviderApiKeyState = { apiKeys: EMPTY_PROVIDER_API_KEYS, saveApiKeys: false };

/** One session store for every dialog; the atomic saved record synchronizes other windows. */
export function createProviderApiKeyStore(options: {
  getStorage: () => StorageLike | null;
  listenForStorage: (refresh: () => void) => () => void;
}) {
  let state = EMPTY_PROVIDER_API_KEY_STATE;
  let initialized = false;
  let lastSaved: string | null = null;
  let stopListening: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  function readSaved(storage: StorageLike): string | null {
    try { return storage.getItem(SHARED_PROVIDER_API_KEY_STORAGE_KEY); } catch { return null; }
  }

  function refresh() {
    const storage = options.getStorage();
    if (!storage) return;
    const saved = readSaved(storage);
    if (initialized && saved === lastSaved) return;
    state = loadSharedProviderApiKeys(storage);
    initialized = true;
    lastSaved = readSaved(storage);
    notify();
  }

  function update(change: (current: ProviderApiKeyState) => ProviderApiKeyState) {
    // Merge the latest saved values first so editing one provider never overwrites another
    // window's changes to a different provider.
    refresh();
    state = change(state);
    const storage = options.getStorage();
    if (storage) {
      persistSharedProviderApiKeys(storage, state);
      lastSaved = readSaved(storage);
    }
    initialized = true;
    notify();
  }

  const updateApiKey = (provider: CityGenerationProvider, value: string) => update((current) => ({
    ...current, apiKeys: { ...current.apiKeys, [provider]: value },
  }));

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        stopListening = options.listenForStorage(refresh);
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { stopListening?.(); stopListening = undefined; }
      };
    },
    setSaveApiKeys: (saveApiKeys: boolean) => update((current) => ({ ...current, saveApiKeys })),
    updateApiKey,
    clearCurrentProviderApiKey: (provider: CityGenerationProvider) => updateApiKey(provider, ''),
    clearAllSavedApiKeys: () => update((current) => ({ ...current, apiKeys: { ...EMPTY_PROVIDER_API_KEYS } })),
  };
}
