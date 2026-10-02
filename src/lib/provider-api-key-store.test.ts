import { describe, expect, it, vi } from 'vitest';
import { createProviderApiKeyStore } from '@/lib/provider-api-key-store';
import { EMPTY_PROVIDER_API_KEYS, loadSharedProviderApiKeys } from '@/lib/provider-api-key-storage';

function fixture() {
  const values = new Map<string, string>();
  const events = new Set<() => void>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const makeWindow = () => createProviderApiKeyStore({
    getStorage: () => storage,
    listenForStorage: (refresh) => { events.add(refresh); return () => { events.delete(refresh); }; },
  });
  return { storage, makeWindow, dispatch: () => events.forEach((refresh) => refresh()) };
}

describe('shared provider API-key state', () => {
  it('updates every mounted dialog and keeps unsaved keys through a dialog remount', () => {
    const { makeWindow, storage } = fixture();
    const store = makeWindow();
    const cityDialog = vi.fn();
    const transportDialog = vi.fn();
    const unsubscribeCity = store.subscribe(cityDialog);
    const unsubscribeTransport = store.subscribe(transportDialog);
    store.updateApiKey('openai', 'session-fixture');
    expect(store.getSnapshot().apiKeys.openai).toBe('session-fixture');
    expect(cityDialog).toHaveBeenCalled();
    expect(transportDialog).toHaveBeenCalled();
    expect(loadSharedProviderApiKeys(storage).apiKeys.openai).toBe('');
    unsubscribeCity(); unsubscribeTransport();
    store.subscribe(() => {});
    expect(store.getSnapshot().apiKeys.openai).toBe('session-fixture');
  });

  it('shares saved keys between windows, merges edits, and synchronizes clearing and opt-out', () => {
    const { makeWindow, storage, dispatch } = fixture();
    const first = makeWindow();
    const second = makeWindow();
    first.subscribe(() => {}); second.subscribe(() => {});
    first.setSaveApiKeys(true);
    first.updateApiKey('openai', 'openai-fixture');
    // Edit before the queued storage event is delivered: retain the other provider.
    second.updateApiKey('gemini', 'gemini-fixture');
    dispatch();
    expect(first.getSnapshot()).toEqual(second.getSnapshot());
    expect(first.getSnapshot().apiKeys).toEqual({ ...EMPTY_PROVIDER_API_KEYS, openai: 'openai-fixture', gemini: 'gemini-fixture' });
    second.clearCurrentProviderApiKey('openai'); dispatch();
    expect(first.getSnapshot().apiKeys.openai).toBe('');
    first.clearAllSavedApiKeys(); dispatch();
    expect(second.getSnapshot().apiKeys).toEqual(EMPTY_PROVIDER_API_KEYS);
    first.updateApiKey('openai', 'session-fixture');
    first.setSaveApiKeys(false); dispatch();
    expect(first.getSnapshot().apiKeys.openai).toBe('session-fixture');
    expect(second.getSnapshot()).toEqual({ apiKeys: EMPTY_PROVIDER_API_KEYS, saveApiKeys: false });
    expect(loadSharedProviderApiKeys(storage)).toEqual(second.getSnapshot());
  });

  it('catches up after remount when another window saved a key while no dialogs were open', () => {
    const { makeWindow } = fixture();
    const first = makeWindow(); const second = makeWindow();
    const unsubscribe = second.subscribe(() => {}); unsubscribe();
    first.setSaveApiKeys(true); first.updateApiKey('anthropic', 'fixture');
    second.subscribe(() => {});
    expect(second.getSnapshot().apiKeys.anthropic).toBe('fixture');
  });

  it('allows session use when browser storage is blocked', () => {
    const store = createProviderApiKeyStore({ getStorage: () => null, listenForStorage: () => () => {} });
    store.subscribe(() => {}); store.updateApiKey('openai', 'session-fixture');
    expect(store.getSnapshot().apiKeys.openai).toBe('session-fixture');
  });
});
