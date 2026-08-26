import { describe, expect, it } from 'vitest';
import {
  clearPersistedProviderApiKeys,
  EMPTY_PROVIDER_API_KEYS,
  loadProviderApiKeys,
  persistProviderApiKeyPreference,
  persistProviderApiKeys,
  type ProviderApiKeys,
} from '@/lib/provider-api-key-storage';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('provider API-key storage', () => {
  it('does not restore a key when the user has opted out', () => {
    const storage = createStorage();
    const keys: ProviderApiKeys = { ...EMPTY_PROVIDER_API_KEYS, openai: 'secret' };

    persistProviderApiKeys(storage, 'test', keys);
    persistProviderApiKeyPreference(storage, 'test', false);

    expect(loadProviderApiKeys(storage, 'test')).toEqual({
      apiKeys: EMPTY_PROVIDER_API_KEYS,
      saveApiKeys: false,
    });
  });

  it('restores keys only when saving is enabled', () => {
    const storage = createStorage();
    const keys: ProviderApiKeys = { ...EMPTY_PROVIDER_API_KEYS, anthropic: 'secret' };

    persistProviderApiKeys(storage, 'test', keys);
    persistProviderApiKeyPreference(storage, 'test', true);

    expect(loadProviderApiKeys(storage, 'test')).toEqual({
      apiKeys: keys,
      saveApiKeys: true,
    });
  });

  it('migrates a legacy non-empty key store into the visible opt-in state', () => {
    const storage = createStorage();
    const keys: ProviderApiKeys = { ...EMPTY_PROVIDER_API_KEYS, gemini: 'secret' };

    persistProviderApiKeys(storage, 'test', keys);

    expect(loadProviderApiKeys(storage, 'test')).toEqual({
      apiKeys: keys,
      saveApiKeys: true,
    });
    expect(storage.getItem('test.saveApiKeys')).toBe('true');
  });

  it('clears persisted keys without affecting the preference', () => {
    const storage = createStorage();
    persistProviderApiKeyPreference(storage, 'test', true);
    persistProviderApiKeys(storage, 'test', { ...EMPTY_PROVIDER_API_KEYS, openai: 'secret' });

    clearPersistedProviderApiKeys(storage, 'test');

    expect(storage.getItem('test.apiKeys')).toBeNull();
    expect(storage.getItem('test.saveApiKeys')).toBe('true');
  });
});
