import { describe, expect, it } from 'vitest';
import {
  clearPersistedProviderApiKeys,
  EMPTY_PROVIDER_API_KEYS,
  loadProviderApiKeys,
  persistProviderApiKeyPreference,
  persistProviderApiKeys,
  type ProviderApiKeys,
  loadSharedProviderApiKeys,
  persistSharedProviderApiKeys,
  SHARED_PROVIDER_API_KEY_STORAGE_KEY,
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
  it('merges saved feature keys once and removes their old copies', () => {
    const storage = createStorage();
    persistProviderApiKeys(storage, 'holiday-spend.city-generation', { ...EMPTY_PROVIDER_API_KEYS, openai: 'saved-city-fixture' });
    persistProviderApiKeyPreference(storage, 'holiday-spend.city-generation', true);
    persistProviderApiKeys(storage, 'holiday-spend.transport-estimation', { ...EMPTY_PROVIDER_API_KEYS, openai: 'older-transport-fixture', gemini: 'saved-transport-fixture' });
    persistProviderApiKeyPreference(storage, 'holiday-spend.transport-estimation', true);
    const state = loadSharedProviderApiKeys(storage);
    expect(state).toEqual({ saveApiKeys: true, apiKeys: { ...EMPTY_PROVIDER_API_KEYS, openai: 'saved-city-fixture', gemini: 'saved-transport-fixture' } });
    expect(loadSharedProviderApiKeys(storage)).toEqual(state);
    expect(storage.getItem('holiday-spend.city-generation.apiKeys')).toBeNull();
    expect(storage.getItem('holiday-spend.transport-estimation.apiKeys')).toBeNull();
  });

  it('does not migrate opted-out keys or resurrect keys after opting out of shared saving', () => {
    const storage = createStorage();
    persistProviderApiKeys(storage, 'holiday-spend.city-generation', { ...EMPTY_PROVIDER_API_KEYS, openai: 'fixture' });
    persistProviderApiKeyPreference(storage, 'holiday-spend.city-generation', false);
    expect(loadSharedProviderApiKeys(storage)).toEqual({ apiKeys: EMPTY_PROVIDER_API_KEYS, saveApiKeys: false });
    persistSharedProviderApiKeys(storage, { saveApiKeys: false, apiKeys: { ...EMPTY_PROVIDER_API_KEYS, openai: 'session-only-fixture' } });
    // A stale old window must not cause the new shared opt-out to be ignored.
    persistProviderApiKeys(storage, 'holiday-spend.transport-estimation', { ...EMPTY_PROVIDER_API_KEYS, openai: 'stale-fixture' });
    persistProviderApiKeyPreference(storage, 'holiday-spend.transport-estimation', true);
    expect(loadSharedProviderApiKeys(storage)).toEqual({ apiKeys: EMPTY_PROVIDER_API_KEYS, saveApiKeys: false });
  });

  it('keeps legacy values if the shared replacement cannot be written', () => {
    const storage = createStorage();
    persistProviderApiKeys(storage, 'holiday-spend.city-generation', { ...EMPTY_PROVIDER_API_KEYS, openai: 'fixture' });
    persistProviderApiKeyPreference(storage, 'holiday-spend.city-generation', true);
    const restricted = { ...storage, setItem: () => { throw new Error('Storage blocked'); } };
    expect(loadSharedProviderApiKeys(restricted).apiKeys.openai).toBe('fixture');
    expect(storage.getItem('holiday-spend.city-generation.apiKeys')).not.toBeNull();
  });

  it('fails closed on an invalid shared record', () => {
    const storage = createStorage();
    storage.setItem(SHARED_PROVIDER_API_KEY_STORAGE_KEY, '{invalid');
    expect(loadSharedProviderApiKeys(storage)).toEqual({ apiKeys: EMPTY_PROVIDER_API_KEYS, saveApiKeys: false });
  });
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
