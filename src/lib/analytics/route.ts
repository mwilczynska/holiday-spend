import { analyticsContext } from './context';
import { ensureAnalyticsWorker, recordEvent } from './service';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function headerId(request: Request, name: string) {
  const value = request.headers.get(name);
  return value && uuid.test(value) ? value : null;
}
/** The wrapper never reads request bodies, query strings, credentials or response contents. */
export function instrumentRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>, route: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  return async (...args: A): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : new Request('http://localhost' + route);
    const requestId = crypto.randomUUID();
    const operationId = headerId(request, 'x-analytics-operation') ?? crypto.randomUUID();
    const started = performance.now();
    ensureAnalyticsWorker();
    return analyticsContext.run({ requestId, operationId, route,
      sessionId: headerId(request, 'x-analytics-session'), pageViewId: headerId(request, 'x-analytics-page'),
      device: request.headers.get('sec-ch-ua-mobile') === '?1' ? 'mobile' : 'unknown',
    }, async () => {
      let status = 500;
      try {
        const response = await handler(...args);
        status = response.status;
        if (status < 400 && method !== 'GET' && !route.startsWith('/api/auth/') && !route.includes('admin/analytics') && !route.includes('settings/analytics') && !route.includes('/itinerary/') && !route.includes('/saved-plans') && route !== '/api/settings/currency' && route !== '/api/planner/settings') {
          if (route !== '/api/expenses/import/csv') recordEvent('mutation_committed', { action: route.replace(/^\/api\//, '').replace(/\[([^\]]+)\]/g, '$1').replaceAll('/', '.') + '.' + method.toLowerCase() });
        }
        response.headers.set('x-request-id', requestId);
        return response;
      } finally {
        recordEvent('request_completed', { method, status, durationMs: Math.round((performance.now() - started) * 100) / 100,
          resource: route.replace(/^\/api\//, '').replace(/\[([^\]]+)\]/g, '$1').replaceAll('/', '.'),
          outcome: request.signal.aborted ? 'cancelled' : status < 400 ? 'success' : 'failure',
        });
      }
    });
  };
}
