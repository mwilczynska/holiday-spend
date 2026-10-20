export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAnalytics } = await import('./lib/analytics/startup');
    startAnalytics();
  }
}

export async function onRequestError(error: { name?: string; digest?: string }, _request: unknown, context: { routeType?: string; routePath?: string }) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { captureServerError } = await import('./lib/analytics/startup');
    captureServerError(error, context.routeType === 'render' ? 'render' : 'request', context.routePath);
  }
}
