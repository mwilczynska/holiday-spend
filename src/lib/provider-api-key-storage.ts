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

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProviderApiKeyState {
  apiKeys: ProviderApiKeys;
  saveApiKeys: boolean;
}

export const SHARED_PROVIDER_API_KEY_STORAGE_KEY = 'holiday-spend.provider-api-keys';
const LEGACY_STORAGE_PREFIXES = ['holiday-spend.city-generation', 'holiday-spend.transport-estimation'];

export function persistSharedProviderApiKeys(storage: StorageLike, state: ProviderApiKeyState) {
  try {
    // One atomic record keeps the preference and its saved values in step across windows.
    storage.setItem(SHARED_PROVIDER_API_KEY_STORAGE_KEY, JSON.stringify({
      saveApiKeys: state.saveApiKeys,
      apiKeys: state.saveApiKeys ? state.apiKeys : EMPTY_PROVIDER_API_KEYS,
    }));
    for (const prefix of LEGACY_STORAGE_PREFIXES) {
      storage.removeItem(`${prefix}.apiKeys`);
      storage.removeItem(`${prefix}.saveApiKeys`);
    }
  } catch {
    // Keep session use working if browser storage is unavailable. Never delete a legacy
    // saved key before its replacement has been written successfully.
  }
}

export function loadSharedProviderApiKeys(storage: StorageLike): ProviderApiKeyState {
  const empty = { apiKeys: { ...EMPTY_PROVIDER_API_KEYS }, saveApiKeys: false };
  try {
    const raw = storage.getItem(SHARED_PROVIDER_API_KEY_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      return parsed?.saveApiKeys === true
        ? { apiKeys: parseProviderApiKeys(JSON.stringify(parsed.apiKeys)) ?? empty.apiKeys, saveApiKeys: true }
        : empty;
    }
    const migrated: ProviderApiKeyState = { apiKeys: { ...EMPTY_PROVIDER_API_KEYS }, saveApiKeys: false };
    for (const prefix of LEGACY_STORAGE_PREFIXES) {
      const legacy = loadProviderApiKeys(storage, prefix);
      if (!legacy.saveApiKeys) continue;
      migrated.saveApiKeys = true;
      for (const provider of CITY_GENERATION_PROVIDER_OPTIONS) {
        if (!migrated.apiKeys[provider.value].trim()) migrated.apiKeys[provider.value] = legacy.apiKeys[provider.value];
      }
    }
    persistSharedProviderApiKeys(storage, migrated);
    return migrated;
  } catch {
    return empty;
  }
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
