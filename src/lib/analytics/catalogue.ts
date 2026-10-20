import { z } from 'zod';
import { ANALYTICS_ROUTES } from './routes';
export { normalizedPage } from './routes';

export const routeSchema = z.enum(ANALYTICS_ROUTES);
const id = z.string().uuid();
const count = z.number().int().nonnegative().max(1_000_000);
const control = z.string().regex(/^[a-z][a-z0-9_.:-]{0,79}$/);
const outcome = z.enum(['success', 'failure', 'cancelled']);
const definitions = {
  page_viewed: z.object({}).strict(),
  control_activated: z.object({ control, surface: z.enum(['mobile', 'desktop']) }).strict(),
  selection_changed: z.object({ control, value: z.enum(['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD', 'JPY', 'CHF', 'CNY', 'THB', '1', '2', '3', '4', '5', 'hostel', 'privateRoom', '1star', '2star', '3star', '4star', 'street', 'budget', 'mid', 'high', 'none', 'light', 'moderate', 'heavy', 'free', 'planned', 'active', 'completed', 'openai', 'anthropic', 'gemini', 'low', 'medium', 'xhigh', 'max']).optional() }).strict(),
  workflow_step: z.object({ workflow: z.enum(['plan', 'city', 'transport', 'expense', 'wise_import', 'comparison', 'auth', 'settings']), step: control, outcome: outcome.optional(), count: count.optional() }).strict(),
  currency_change_requested: z.object({ from: z.string().regex(/^[A-Z]{3}$/), to: z.string().regex(/^[A-Z]{3}$/) }).strict(),
  currency_change_confirmed: z.object({ currency: z.string().regex(/^[A-Z]{3}$/) }).strict(),
  browser_error: z.object({ kind: z.enum(['error', 'unhandled_rejection']), fingerprint: z.string().regex(/^[0-9a-f]{8}$/) }).strict(),
  web_vital: z.object({ metric: z.enum(['LCP', 'CLS', 'INP', 'TTFB']), value: z.number().finite().nonnegative().max(3_600_000) }).strict(),
  request_completed: z.object({ method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']), status: z.number().int().min(100).max(599), durationMs: z.number().nonnegative(), resource: control, outcome }).strict(),
  mutation_committed: z.object({ action: control, entityId: z.string().max(100).optional(), revisionId: z.number().int().optional(), legCount: count.optional(), totalNights: count.optional(), totalBudgetAud: z.number().finite().optional() }).strict(),
  currency_change_succeeded: z.object({ from: z.string().regex(/^[A-Z]{3}$/), to: z.string().regex(/^[A-Z]{3}$/), rateDate: z.string().nullable() }).strict(),
  admin_accessed: z.object({ action: z.enum(['report', 'revision', 'export', 'erase']), subject: z.string().max(100).optional() }).strict(),
};
export type EventName = keyof typeof definitions;
export type EventProperties<N extends EventName> = z.infer<(typeof definitions)[N]>;
export const BROWSER_EVENTS = ['page_viewed', 'control_activated', 'selection_changed', 'workflow_step', 'currency_change_requested', 'currency_change_confirmed', 'browser_error', 'web_vital'] as const;
export const browserEventSchema = z.object({
  id, name: z.enum(BROWSER_EVENTS), version: z.literal(1), occurredAt: z.string().datetime(),
  sessionId: id, pageViewId: id, operationId: id.optional(), route: routeSchema, properties: z.unknown(),
}).strict().superRefine((event, ctx) => {
  if (!definitions[event.name].safeParse(event.properties).success) ctx.addIssue({ code: 'custom', message: 'Invalid event properties' });
});
export type BrowserEvent = z.infer<typeof browserEventSchema>;
export const browserBatchSchema = z.object({ events: z.array(browserEventSchema).min(1).max(50) }).strict();
export function parseProperties<N extends EventName>(name: N, value: unknown): EventProperties<N> {
  return definitions[name].parse(value) as EventProperties<N>;
}
export const BEHAVIOR_EVENTS = new Set<EventName>(['page_viewed', 'control_activated', 'selection_changed', 'workflow_step', 'currency_change_requested', 'currency_change_confirmed', 'mutation_committed', 'currency_change_succeeded']);
export interface AnalyticsEvent {
  id: string; name: EventName; version: 1; occurredAt: string; receivedAt: string;
  source: 'browser' | 'server' | 'job'; purpose: 'behavior' | 'diagnostic' | 'audit';
  environment: string; release: string; accountId: string | null; administrator: boolean;
  sessionId: string | null; pageViewId: string | null; operationId: string | null; requestId: string | null;
  route: string; device: 'mobile' | 'desktop' | 'unknown'; properties: unknown;
}
