'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { analyticsPageView, beginAnalyticsOperation, flushBrowserAnalytics, installAnalyticsFetch, setBrowserAnalyticsActor, setBrowserAnalyticsEnabled, trackEvent } from '@/lib/analytics/browser';

export function AnalyticsProvider({ identity, initialEnabled }: { identity: string; initialEnabled: boolean }) {
  const pathname = usePathname();
  useReportWebVitals(metric => {
    if (metric.name === 'LCP' || metric.name === 'CLS' || metric.name === 'INP' || metric.name === 'TTFB') trackEvent('web_vital', { metric: metric.name, value: metric.value });
  });
  useEffect(() => {
    setBrowserAnalyticsEnabled(initialEnabled);
    setBrowserAnalyticsActor(identity);
    const uninstall = installAnalyticsFetch();
    let channel: BroadcastChannel | undefined;
    const synchronize = () => { void fetch('/api/settings/analytics', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(body => {
      if (typeof body?.data?.enabled === 'boolean') setBrowserAnalyticsEnabled(body.data.enabled);
    }).catch(() => { setBrowserAnalyticsEnabled(false); }); };
    const preference = (event: Event) => {
      const value = (event as CustomEvent<boolean>).detail;
      setBrowserAnalyticsEnabled(value); channel?.postMessage('changed');
    };
    try { channel = new BroadcastChannel('holiday-spend-analytics'); channel.onmessage = synchronize; } catch { /* Focus refresh remains available. */ }
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-analytics]') : null;
      if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return;
      beginAnalyticsOperation();
      trackEvent('control_activated', { control: target.dataset.analytics || '', surface: matchMedia('(max-width: 639px)').matches ? 'mobile' : 'desktop' });
    };
    const change = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.dataset.analytics) return;
      trackEvent('selection_changed', { control: target.dataset.analytics });
    };
    const onHide = () => { if (document.visibilityState === 'hidden') void flushBrowserAnalytics(); };
    const onError = (event: Event) => {
      // Hash locally; messages and stack traces can contain personal data.
      const raw = event instanceof ErrorEvent ? event.message : String((event as PromiseRejectionEvent).reason?.name || 'rejection');
      let hash = 2166136261; for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
      trackEvent('browser_error', { kind: event.type === 'error' ? 'error' : 'unhandled_rejection', fingerprint: (hash >>> 0).toString(16).padStart(8, '0') });
    };
    document.addEventListener('click', click, true); document.addEventListener('change', change, true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('analytics-preference', preference); window.addEventListener('focus', synchronize);
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onError);
    const interval = setInterval(() => void flushBrowserAnalytics(), 5000);
    return () => {
      clearInterval(interval); channel?.close(); uninstall(); setBrowserAnalyticsEnabled(false);
      document.removeEventListener('click', click, true); document.removeEventListener('change', change, true);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('analytics-preference', preference); window.removeEventListener('focus', synchronize);
      window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError);
    };
  }, [identity, initialEnabled]);
  useEffect(() => { analyticsPageView(pathname); }, [pathname]);
  return null;
}
