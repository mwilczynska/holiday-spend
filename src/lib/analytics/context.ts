import { AsyncLocalStorage } from 'node:async_hooks';
export interface AnalyticsContext {
  requestId: string; operationId: string; route: string; userId?: string; administrator?: boolean;
  sessionId: string | null; pageViewId: string | null; device: 'mobile' | 'desktop' | 'unknown';
  llmTimeoutMs?: number;
}
export const analyticsContext = new AsyncLocalStorage<AnalyticsContext>();
export function setAnalyticsActor(userId: string, administrator: boolean) {
  const context = analyticsContext.getStore();
  if (context) { context.userId = userId; context.administrator = administrator; }
}
