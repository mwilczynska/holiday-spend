'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export function AnalyticsSettings({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    void fetch('/api/settings/analytics', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok || typeof body?.data?.enabled !== 'boolean') throw new Error('Analytics preference unavailable.');
      setEnabled(body.data.enabled);
      setDraft(current => current === body.data.enabled ? null : current);
    }).catch(() => setError('Analytics preference unavailable. Retry.'));
  };
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, []);
  async function save(next: boolean) {
    if (pending) return;
    setDraft(next);
    setPending(true); setError(null);
    try {
      const response = await fetch('/api/settings/analytics', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }) });
      const body = await response.json();
      if (!response.ok || body?.data?.enabled !== next) throw new Error();
      setEnabled(next); setDraft(null); window.dispatchEvent(new CustomEvent('analytics-preference', { detail: next }));
    } catch { setError('Preference could not be confirmed. Retry your selection.'); }
    finally { setPending(false); }
  }
  return <section className={compact ? 'mt-6 border-t pt-4 text-sm' : 'space-y-3 border-t py-6'} aria-label="Product analytics">
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={compact ? 'analytics-public' : 'analytics-setting'} className="font-medium">Share product usage analytics</label>
      <Switch id={compact ? 'analytics-public' : 'analytics-setting'} checked={(draft ?? enabled) === true} disabled={pending || enabled === null} onCheckedChange={save} />
    </div>
    <p className="text-sm text-muted-foreground">Enabled by default. Usage events stay on our server with no scheduled expiry. Disabling stops future behavioral tracking; private plan history and necessary diagnostics continue. <Link href="/privacy" className="underline">Privacy details</Link></p>
    {pending && <p role="status">Saving…</p>}
    {draft !== null && !pending && <p className="text-sm">Unsaved preference. Last confirmed: {enabled ? 'enabled' : 'disabled'}. <Button variant="link" onClick={() => void save(draft)}>Retry</Button><Button variant="link" onClick={() => { setDraft(null); setError(null); }}>Discard</Button></p>}
    {error && <p role="alert">{error} <Button variant="link" onClick={load}>Reload preference</Button></p>}
    {enabled === null && !error && <p className="text-sm text-muted-foreground">Loading preference…</p>}
  </section>;
}
