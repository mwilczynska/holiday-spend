// Display helpers for the analytics dashboard: one date format, one number format and readable
// names for the event, action, step and health codes the reports return.

const dateTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const integer = new Intl.NumberFormat();
const aud = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export const UNAVAILABLE = '—';

/** Timestamp in the viewer's timezone, e.g. "21 Oct 2026, 3:48 pm". */
export function formatDateTime(value: unknown): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? dateTime.format(new Date(value)) : UNAVAILABLE;
}

/** A UTC day bucket ("2026-10-21") as "21 Oct"; buckets are UTC, so they are formatted in UTC. */
export function formatDay(day: string, withYear = false): string {
  const date = new Date(day + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) ? (withYear ? longDay : dayFormat).format(date) : day;
}

export function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? integer.format(value) : UNAVAILABLE;
}

export function formatAud(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? aud.format(value) : UNAVAILABLE;
}

export function formatBytes(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return UNAVAILABLE;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return (unit ? size.toFixed(size < 10 ? 1 : 0) : String(size)) + ' ' + units[unit];
}

export function formatDuration(ms: unknown): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return UNAVAILABLE;
  if (ms < 1000) return Math.round(ms) + ' ms';
  if (ms < 60_000) return (ms / 1000).toFixed(ms < 10_000 ? 1 : 0) + ' s';
  return Math.floor(ms / 60_000) + ' min ' + Math.round((ms % 60_000) / 1000) + ' s';
}

/** Today's date (or an offset from it) in the viewer's own timezone, as YYYY-MM-DD. */
export function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

/**
 * Default "Through" date. Reports filter by UTC day, so a browser behind UTC (the Americas) would
 * otherwise exclude events recorded after UTC midnight; take whichever of its local date and the
 * UTC date is later.
 */
export function defaultThrough(): string {
  const utc = new Date().toISOString().slice(0, 10);
  const local = localDate();
  return utc > local ? utc : local;
}

/** `days` before a YYYY-MM-DD date, as YYYY-MM-DD. */
export function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') - days * 86_400_000).toISOString().slice(0, 10);
}

/** "leg_created", "cities.create-with-generation" or "deliveryDelayed" as plain words. */
export function humanize(code: string): string {
  const words = code.replace(/^\/api\//, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._\-/]+/g, ' ').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : code;
}

const EVENT_LABELS: Record<string, string> = {
  page_viewed: 'Page view',
  control_activated: 'Control used',
  selection_changed: 'Selection changed',
  workflow_step: 'Workflow step',
  currency_change_requested: 'Currency change requested',
  currency_change_confirmed: 'Currency change confirmed',
  currency_change_succeeded: 'Currency change saved',
  mutation_committed: 'Change saved',
  request_completed: 'API request',
  browser_error: 'Browser error',
  server_error: 'Server error',
  web_vital: 'Web Vital',
  admin_accessed: 'Admin access',
};
export function eventLabel(name: unknown): string {
  return typeof name === 'string' ? EVENT_LABELS[name] ?? humanize(name) : UNAVAILABLE;
}

const ACTION_LABELS: Record<string, string> = { migration_baseline: 'History started' };
export function actionLabel(action: unknown): string {
  return typeof action === 'string' ? ACTION_LABELS[action] ?? humanize(action) : UNAVAILABLE;
}

const STEP_LABELS: Record<string, string> = {
  '/signup': 'Opened sign-up',
  signup_created: 'Created an account',
  verification_completed: 'Verified email',
  login_succeeded: 'Signed in',
  '/plan': 'Opened the planner',
  leg_created: 'Added a leg',
  plan_saved: 'Saved a plan',
  preview: 'Previewed a Wise import',
  expenses_imported: 'Imported expenses',
  generation_requested: 'Requested a new city',
  'cities.create-with-generation': 'City generated and saved',
};
export function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? humanize(step);
}

/** A page route for display: "/" reads as the dashboard. */
export function routeLabel(route: unknown): string {
  if (typeof route !== 'string' || !route) return UNAVAILABLE;
  return route === '/' ? 'Dashboard (/)' : route;
}

/** Event properties as short "Label: value" pairs instead of raw JSON. */
export function describeProperties(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, v]) => {
      const label = humanize(key);
      if (key === 'durationMs') return ['Duration', formatDuration(v)];
      if (key === 'totalBudgetAud') return ['Budget', formatAud(v)];
      if (key === 'action' || key === 'step') return [label, humanize(String(v))];
      if (typeof v === 'number') return [label, formatNumber(v)];
      if (typeof v === 'boolean') return [label, v ? 'Yes' : 'No'];
      if (typeof v === 'object') { const text = JSON.stringify(v); return [label, text.length > 60 ? text.slice(0, 57) + '…' : text]; }
      return [label, String(v)];
    });
}

/** A value from a revision diff: short and readable, never a wall of JSON. */
export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return UNAVAILABLE;
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') { const text = JSON.stringify(value); return text.length > 120 ? text.slice(0, 117) + '…' : text; }
  return String(value);
}

/** One row per UTC day from `from` to `to`, with zero where nothing was recorded. */
export function zeroFillDays<T extends { day: string }>(rows: T[], from: string, to: string, empty: Omit<T, 'day'>): T[] {
  const byDay = new Map(rows.map(row => [row.day, row]));
  const result: T[] = [];
  const end = Date.parse(to + 'T00:00:00Z');
  for (let time = Date.parse(from + 'T00:00:00Z'); Number.isFinite(time) && time <= end && result.length <= 366; time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    result.push(byDay.get(day) ?? ({ day, ...empty } as T));
  }
  return result;
}

export type Rating = 'good' | 'needs-improvement' | 'poor';
/** Google's published Web Vitals thresholds (good / poor boundaries) and units. */
export const VITALS: Record<string, { label: string; unit: 'ms' | 'score'; good: number; poor: number; meaning: string }> = {
  LCP: { label: 'Largest Contentful Paint', unit: 'ms', good: 2500, poor: 4000, meaning: 'Main content visible' },
  INP: { label: 'Interaction to Next Paint', unit: 'ms', good: 200, poor: 500, meaning: 'Response to taps and clicks' },
  CLS: { label: 'Cumulative Layout Shift', unit: 'score', good: 0.1, poor: 0.25, meaning: 'Visual stability' },
  TTFB: { label: 'Time to First Byte', unit: 'ms', good: 800, poor: 1800, meaning: 'Server response' },
};
export function rateVital(metric: string, value: unknown): Rating | null {
  const vital = VITALS[metric];
  if (!vital || typeof value !== 'number') return null;
  return value <= vital.good ? 'good' : value <= vital.poor ? 'needs-improvement' : 'poor';
}
export function formatVital(metric: string, value: unknown): string {
  if (typeof value !== 'number') return UNAVAILABLE;
  return VITALS[metric]?.unit === 'score' ? value.toFixed(2) : formatDuration(value);
}
