import { z } from 'zod';
export const reportQuerySchema = z.object({
  view: z.enum(['overview', 'journeys', 'funnels', 'plans', 'llm', 'health']).default('overview'),
  from: z.string().date(), to: z.string().date(),
  environment: z.enum(['production', 'development', 'test']).default('production'),
  includeAdmins: z.enum(['true', 'false']).default('false'),
  account: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  operation: z.string().uuid().optional(),
  release: z.string().max(100).optional(),
  device: z.enum(['mobile', 'desktop', 'unknown']).optional(),
  feature: z.enum(['planner', 'expenses', 'currency', 'cities', 'transport', 'auth', 'settings']).optional(),
  cursor: z.coerce.number().int().nonnegative().default(0),
  revision: z.coerce.number().int().positive().optional(),
  export: z.enum(['true', 'false']).optional(),
}).strict().superRefine((v, ctx) => {
  const days = (Date.parse(v.to) - Date.parse(v.from)) / 86400000;
  if (days < 0 || days > 366) ctx.addIssue({ code: 'custom', message: 'Choose an ordered date range of at most 366 days.' });
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export function parseReportQuery(params: URLSearchParams) {
  return reportQuerySchema.parse({ from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), ...Object.fromEntries(params) });
}
export function predicate(q: ReportQuery, llm = false) {
  const clauses = [`${llm ? 'started_at' : 'received_at'} >= @from`, `${llm ? 'started_at' : 'received_at'} < @until`, 'environment=@environment'];
  const args: Record<string, string | number> = { from: q.from + 'T00:00:00.000Z', until: new Date(Date.parse(q.to) + 86400000).toISOString(), environment: q.environment };
  if (q.includeAdmins === 'false') clauses.push('administrator=0');
  if (q.account) { clauses.push('account_id=@account'); args.account = q.account; }
  if (q.operation) { clauses.push('operation_id=@operation'); args.operation = q.operation; }
  if (q.release) { clauses.push('release=@release'); args.release = q.release; }
  if (q.device && !llm) { clauses.push('device=@device'); args.device = q.device; }
  if (q.feature) {
    if (llm) {
      if (q.feature === 'transport' || q.feature === 'cities') { clauses.push('feature=@feature'); args.feature = q.feature === 'transport' ? 'transport' : 'city'; }
      else if (q.feature !== 'planner') clauses.push('1=0');
    }
    else {
      const routes: Record<string, string[]> = { planner: ['/plan', '/api/itinerary%', '/api/saved-plans%'], expenses: ['/track%', '/api/expenses%', '/api/tags%'], currency: ['/api/settings/currency'], cities: ['/dataset', '/api/cities%'], transport: ['/api/itinerary/legs/[id]/estimate-transport'], auth: ['/login', '/signup', '/api/auth%'], settings: ['/settings%', '/api/settings%', '/api/planner/settings'] };
      clauses.push('(' + routes[q.feature].map((route, i) => { args['route' + i] = route; return 'route LIKE @route' + i; }).join(' OR ') + ')');
    }
  }
  return { where: clauses.join(' AND '), args };
}
