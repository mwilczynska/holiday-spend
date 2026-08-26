import {
  CITY_GENERATION_PROVIDER_OPTIONS,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';

export type ProviderApiKeys = Record<CityGenerationProvider, string>;

export const EMPTY_PROVIDER_API_KEYS: ProviderApiKeys = {
  openai: '',
  anthropic: '',
  gemini: '',
};

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function emptyProviderApiKeys(): ProviderApiKeys {
  return { ...EMPTY_PROVIDER_API_KEYS };
}

function parseProviderApiKeys(rawValue: string | null): ProviderApiKeys | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<Record<CityGenerationProvider, unknown>>;
    return CITY_GENERATION_PROVIDER_OPTIONS.reduce((keys, option) => {
      const value = parsed[option.value];
      keys[option.value] = typeof value === 'string' ? value : '';
      return keys;
    }, emptyProviderApiKeys());
  } catch {
    return null;
  }
}

function hasProviderApiKey(apiKeys: ProviderApiKeys) {
  return Object.values(apiKeys).some((value) => value.trim().length > 0);
}

function savePreferenceKey(storagePrefix: string) {
  return `${storagePrefix}.saveApiKeys`;
}

function apiKeysKey(storagePrefix: string) {
  return `${storagePrefix}.apiKeys`;
}

export function loadProviderApiKeys(storage: StorageLike, storagePrefix: string): {
  apiKeys: ProviderApiKeys;
  saveApiKeys: boolean;
} {
  let storedApiKeys: ProviderApiKeys | null = null;
  let storedPreference: string | null = null;

  try {
    storedApiKeys = parseProviderApiKeys(storage.getItem(apiKeysKey(storagePrefix)));
    storedPreference = storage.getItem(savePreferenceKey(storagePrefix));
  } catch {
    return {
      apiKeys: emptyProviderApiKeys(),
      saveApiKeys: false,
    };
  }

  if (storedPreference === 'true') {
    return {
      apiKeys: storedApiKeys ?? emptyProviderApiKeys(),
      saveApiKeys: true,
    };
  }

  if (storedPreference === 'false' || !storedApiKeys || !hasProviderApiKey(storedApiKeys)) {
    return {
      apiKeys: emptyProviderApiKeys(),
      saveApiKeys: false,
    };
  }

  // Before the checkbox existed, non-empty keys were always persisted. Treat those
  // values as an explicit legacy opt-in and surface the checked state to the user.
  try {
    storage.setItem(savePreferenceKey(storagePrefix), 'true');
  } catch {
    // A restricted browser storage implementation should not block the dialog.
  }

  return {
    apiKeys: storedApiKeys,
    saveApiKeys: true,
  };
}

export function persistProviderApiKeys(storage: StorageLike, storagePrefix: string, apiKeys: ProviderApiKeys) {
  try {
    storage.setItem(apiKeysKey(storagePrefix), JSON.stringify(apiKeys));
  } catch {
    // A restricted browser storage implementation should not block the dialog.
  }
}

export function clearPersistedProviderApiKeys(storage: StorageLike, storagePrefix: string) {
  try {
    storage.removeItem(apiKeysKey(storagePrefix));
  } catch {
    // A restricted browser storage implementation should not block the dialog.
  }
}

export function persistProviderApiKeyPreference(storage: StorageLike, storagePrefix: string, saveApiKeys: boolean) {
  try {
    storage.setItem(savePreferenceKey(storagePrefix), saveApiKeys ? 'true' : 'false');
  } catch {
    // A restricted browser storage implementation should not block the dialog.
  }
}
