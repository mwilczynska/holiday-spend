'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { formatDisplayMoney, parseCurrencyState, type DisplayCurrency, type DisplayCurrencyState } from '@/lib/display-currency';

interface CurrencyContextValue extends DisplayCurrencyState {
  format: (amountAud: number, digits?: number) => string;
  saving: boolean;
  draft: DisplayCurrency | null;
  change: (currency: DisplayCurrency) => Promise<void>;
  refresh: () => Promise<void>;
  discard: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ initial, children, enabled = true }: {
  initial: DisplayCurrencyState;
  children: ReactNode;
  enabled?: boolean;
}) {
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DisplayCurrency | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const draftRef = useRef<DisplayCurrency | null>(null);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    const currentRevision = ++revision.current;
    try {
      const response = await fetch('/api/settings/currency', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load currency settings.');
      const next = parseCurrencyState(body.data);
      if (currentRevision !== revision.current) return;
      setState(next);
      // A reread can confirm a write whose acknowledgement was lost. Otherwise retain its draft and error.
      if (next.currency === draftRef.current && next.rate != null) {
        draftRef.current = null;
        setDraft(null);
        setSaveError(null);
      }
    } catch (err) {
      if (currentRevision === revision.current) {
        setState(current => ({ ...current, rate: current.currency === 'AUD' ? 1 : null,
          error: err instanceof Error ? err.message : 'Currency settings unavailable.' }));
      }
    }
  }, [enabled]);

  const change = useCallback(async (currency: DisplayCurrency) => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    ++revision.current;
    draftRef.current = currency;
    setSaving(true);
    setDraft(currency);
    setSaveError(null);
    try {
      const response = await fetch('/api/settings/currency', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save currency (HTTP ' + response.status + ').');
      const next = parseCurrencyState(body.data);
      if (next.currency !== currency || next.rate == null) {
        throw new Error('The server did not confirm the selected currency. Refresh before retrying.');
      }
      setState(next);
      draftRef.current = null;
      setDraft(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save currency.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 3600000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, [refresh]);

  const value = useMemo(() => ({
    ...state, error: saveError ?? state.error, saving, draft, change, refresh,
    discard: () => { draftRef.current = null; setDraft(null); setSaveError(null); },
    format: (amount: number, digits = 0) => formatDisplayMoney(amount, state, digits),
  }), [state, saveError, saving, draft, change, refresh]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('CurrencyProvider is required.');
  return value;
}
