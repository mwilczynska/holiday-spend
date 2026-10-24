import { createHash } from 'node:crypto';
import { analyticsContext } from './context';
import { getAnalyticsStore } from './storage';
import { providerForHostname } from '@/lib/llm-provider-registry';

const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const label = (value: unknown): string | null => typeof value === 'string' && !/^(sk-|AIza|Bearer )/.test(value) && /^[a-zA-Z0-9_.:/ -]{1,100}$/.test(value) ? value : null;
/** Captures a fixed metadata projection. Request/response content and credentials are never stored. */
export async function analyticsLlmFetch(input: string | URL, init: RequestInit, feature = 'city'): Promise<Response> {
  const ctx = analyticsContext.getStore();
  if (!ctx) return fetch(input, init);
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const id = crypto.randomUUID();
  const url = new URL(input);
  const provider = providerForHostname(url.hostname) ?? 'unknown';
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(String(init.body)); } catch { /* Unknown fields stay unavailable. */ }
  const reasoning = body.reasoning as { effort?: unknown } | undefined;
  const effort = reasoning?.effort ?? body.reasoning_effort ?? (body.output_config as { effort?: unknown } | undefined)?.effort
    ?? (body.generationConfig as { thinkingConfig?: { thinkingLevel?: unknown } } | undefined)?.thinkingConfig?.thinkingLevel;
  const tools = Array.isArray(body.tools) ? body.tools : [];
  const model = label(body.model) ?? label(url.pathname.match(/models\/([^:]+)/)?.[1]);
  const promptHash = createHash('sha256').update(JSON.stringify([body.instructions, body.input, body.system, body.messages, body.contents, body.systemInstruction])).digest('hex');
  let number = 1;
  try {
    const store = getAnalyticsStore();
    const previous = store.prepare('SELECT attempt_number,completion_status,status FROM llm_attempts WHERE operation_id=? ORDER BY attempt_number DESC LIMIT 1').get(ctx.operationId) as { attempt_number: number; completion_status: string | null; status: string } | undefined;
    number = (previous?.attempt_number ?? 0) + 1;
    // Hash the account locally without importing the main database service into provider transports.
    const accountId = ctx.userId ? createHash('sha256').update('holiday-spend:analytics:' + ctx.userId).digest('hex') : null;
    store.prepare(`INSERT INTO llm_attempts(id,operation_id,request_id,account_id,environment,release,administrator,feature,provider,model,effort,prompt_hash,started_at,status,search_required,output_limit,attempt_number,retry_reason)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'started',?,?,?,?)`).run(id, ctx.operationId, ctx.requestId, accountId,
      process.env.HOLIDAY_SPEND_ANALYTICS_ENV || process.env.NODE_ENV || 'development', process.env.HOLIDAY_SPEND_RELEASE || 'local', Number(ctx.administrator ?? false),
      ctx.route.includes('transport') ? 'transport' : feature, provider, model, label(effort ?? ctx.llmRequestedEffort), promptHash, startedAt,
      Number(tools.length > 0), count(body.max_output_tokens ?? body.max_tokens ?? body.max_completion_tokens ?? (body.completion_args as { max_tokens?: unknown } | undefined)?.max_tokens ?? (body.generationConfig as { maxOutputTokens?: unknown })?.maxOutputTokens), number, previous?.completion_status ?? previous?.status ?? null);
    store.prepare('UPDATE llm_attempts SET timeout_ms=?,metadata_json=? WHERE id=?').run(ctx.llmTimeoutMs ?? null, JSON.stringify({ process: process.pid + ':' + Math.round(performance.timeOrigin), promptVersion: ctx.promptVersion ?? null, methodologyVersion: ctx.methodologyVersion ?? null, thinkingBudget: count((body.thinking as { budget_tokens?: unknown })?.budget_tokens ?? ((body.generationConfig as { thinkingConfig?: { thinkingBudget?: unknown } })?.thinkingConfig?.thinkingBudget)) }), id);
  } catch { console.warn(JSON.stringify({ component: 'analytics', code: 'llm_start_failed' })); }
  const finish = (status: string, response?: Response, data?: Record<string, unknown>) => {
    try {
      const usage = (data?.usage ?? data?.usageMetadata ?? {}) as Record<string, unknown>;
      const outputDetails = (usage.output_tokens_details ?? usage.completion_tokens_details) as Record<string, unknown> | undefined;
      const inputDetails = usage.input_tokens_details as Record<string, unknown> | undefined;
      const output = Array.isArray(data?.output) ? data.output as Array<{ type?: string; status?: string }> : [];
      const anthropicSearch = usage.server_tool_use as { web_search_requests?: unknown } | undefined;
      const candidates = data?.candidates as Array<{ groundingMetadata?: { webSearchQueries?: unknown[] }; finishReason?: string }> | undefined;
      const searches = Array.isArray(data?.output) ? output.filter(o => o.type === 'web_search_call').length : count(anthropicSearch?.web_search_requests) ?? candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? null;
      const searchUsed = Array.isArray(data?.output) ? Number(output.some(o => o.type === 'web_search_call' && (!o.status || o.status === 'completed'))) : searches == null ? null : Number(searches > 0);
      const choices = data?.choices as Array<{ finish_reason?: string }> | undefined;
      const completion = label(data?.status ?? data?.stop_reason ?? candidates?.[0]?.finishReason ?? choices?.[0]?.finish_reason);
      getAnalyticsStore().prepare(`UPDATE llm_attempts SET ended_at=?,duration_ms=?,status=?,http_status=?,provider_request_id=?,input_tokens=?,output_tokens=?,cached_tokens=?,reasoning_tokens=?,search_used=?,search_count=?,completion_status=?,metadata_json=json_set(metadata_json,'$.returnedModel',?) WHERE id=?`)
        .run(new Date().toISOString(), Math.round(performance.now() - start), status, response?.status ?? null,
          label(response?.headers.get('x-request-id') ?? response?.headers.get('request-id')),
          count(usage.input_tokens ?? usage.promptTokenCount ?? usage.prompt_tokens), count(usage.output_tokens ?? usage.candidatesTokenCount ?? usage.completion_tokens),
          count(inputDetails?.cached_tokens ?? usage.cache_read_input_tokens ?? usage.cachedContentTokenCount),
          count(outputDetails?.reasoning_tokens ?? usage.thoughtsTokenCount), searchUsed, searches, completion, label(data?.model ?? data?.modelVersion), id);
    } catch { console.warn(JSON.stringify({ component: 'analytics', code: 'llm_finish_failed' })); }
  };
  try {
    const response = await fetch(input, init);
    if (!response.ok) { finish('provider_error', response); return response; }
    const json = response.json.bind(response);
    response.json = async () => {
      try {
        const data = await json();
        finish(data.status === 'incomplete' ? 'incomplete' : data.status === 'failed' || data.error ? 'provider_error' : 'received', response, data);
        return data;
      } catch (err) { finish(init.signal?.aborted ? init.signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled' : 'unreadable_response', response); throw err; }
    };
    return response;
  } catch (err) {
    finish(init.signal?.aborted ? init.signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled' : 'network_error');
    throw err;
  }
}
