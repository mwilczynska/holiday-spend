'use client';
import { normalizedPage } from './routes';
import type { BrowserEvent, EventProperties } from './catalogue';

let enabled = false;
let queue: BrowserEvent[] = [];
let sessionId = '';
let pageViewId = '';
let operationId = '';
let lastActivity = 0;
let lastOperation = 0;
let currentRoute: ReturnType<typeof normalizedPage> = null;
let sending = false;
let nativeFetch: typeof fetch | undefined;
let actor = 'anonymous';
function saveSession() {
  try { sessionStorage.setItem('hs.analytics.session', JSON.stringify({ sessionId, lastActivity, actor })); } catch { /* Storage is optional. */ }
}
export function setBrowserAnalyticsActor(identity: string) {
  if (actor !== identity && actor !== 'anonymous') { queue = []; pageViewId = ''; operationId = ''; }
  try {
    const saved = JSON.parse(sessionStorage.getItem('hs.analytics.session') || 'null');
    if (saved && /^[a-f0-9-]{36}$/.test(saved.sessionId) && Date.now() - saved.lastActivity < 1800_000
      && (saved.actor === identity || saved.actor === 'anonymous' && identity !== 'anonymous')) {
      sessionId = saved.sessionId; lastActivity = saved.lastActivity;
    } else { sessionId = ''; lastActivity = 0; }
  } catch { sessionId = ''; lastActivity = 0; }
  actor = identity;
}
export function setBrowserAnalyticsEnabled(value: boolean) {
  const wasEnabled = enabled;
  enabled = value;
  if (!value) { queue = []; sessionId = ''; pageViewId = ''; operationId = ''; try { sessionStorage.removeItem('hs.analytics.session'); } catch {} }
  if (value && !wasEnabled && currentRoute) { pageViewId = crypto.randomUUID(); trackEvent('page_viewed', {}); }
}
export function beginAnalyticsOperation() {
  operationId = crypto.randomUUID(); lastOperation = Date.now();
  return operationId;
}
const safeSelections = new Set(['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD', 'JPY', 'CHF', 'CNY', 'THB', '1', '2', '3', '4', '5', 'hostel', 'privateRoom', '1star', '2star', '3star', '4star', 'street', 'budget', 'mid', 'high', 'none', 'light', 'moderate', 'heavy', 'free', 'planned', 'active', 'completed', 'openai', 'anthropic', 'gemini', 'low', 'medium', 'xhigh', 'max']);
export function trackSelection(control: string, value: string) {
  beginAnalyticsOperation();
  trackEvent('selection_changed', { control, ...(safeSelections.has(value) ? { value: value as EventProperties<'selection_changed'>['value'] } : {}) });
}
export function trackEvent<N extends BrowserEvent['name']>(name: N, properties: EventProperties<N>) {
  if (!enabled || !currentRoute) return;
  try {
    const now = Date.now();
    if (!sessionId || now - lastActivity > 1800_000) sessionId = crypto.randomUUID();
    lastActivity = now;
    saveSession();
    queue.push({ id: crypto.randomUUID(), name: name as BrowserEvent['name'], version: 1, occurredAt: new Date(now).toISOString(),
      sessionId, pageViewId: pageViewId || (pageViewId = crypto.randomUUID()), route: currentRoute,
      ...(operationId && now - lastOperation < 10_000 ? { operationId } : {}), properties });
    queue = queue.slice(-200);
    if (queue.length >= 20) void flushBrowserAnalytics();
  } catch { /* Instrumentation must never break a product action. */ }
}
export function analyticsPageView(path: string) {
  const route = normalizedPage(path);
  if (!route || currentRoute === route) return;
  currentRoute = route; pageViewId = crypto.randomUUID();
  trackEvent('page_viewed', {});
}
export function resetAnalyticsIdentity() {
  void flushBrowserAnalytics();
  setBrowserAnalyticsEnabled(false);
}
export async function flushBrowserAnalytics() {
  if (!enabled || sending || !queue.length || !nativeFetch) return;
  sending = true;
  const batch = queue.splice(0, 50);
  try {
    const response = await nativeFetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }), keepalive: true });
    if (!response.ok && response.status >= 500 && enabled) queue = [...batch, ...queue].slice(-200);
  } catch { if (enabled) queue = [...batch, ...queue].slice(-200); }
  finally { sending = false; }
}
/** Add correlation only to first-party API requests. Never inspect or copy bodies. */
export function installAnalyticsFetch() {
  nativeFetch = window.fetch.bind(window);
  const original = window.fetch;
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (!enabled || url.origin !== location.origin || !url.pathname.startsWith('/api/') || url.pathname.includes('/analytics')) return original(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (sessionId) headers.set('x-analytics-session', sessionId);
    if (pageViewId) headers.set('x-analytics-page', pageViewId);
    headers.set('x-analytics-operation', operationId && Date.now() - lastOperation < 10_000 ? operationId : crypto.randomUUID());
    return original(input, { ...init, headers });
  };
  return () => { window.fetch = original; nativeFetch = undefined; currentRoute = null; queue = []; };
}
