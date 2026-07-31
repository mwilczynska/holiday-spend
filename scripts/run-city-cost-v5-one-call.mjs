// Experiment 001 harness. It makes exactly one provider request when a key is
// supplied, optionally with the provider's built-in web search, and records
// request/response telemetry without retrying or falling back to another model.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const PROMPT_PATH = 'docs/prompts/llm_prompt_city_cost_v5_experiment_001.md';
const MEASURES = [
  'hostel_dorm_bed_1p', 'hostel_private_room_2p', 'hotel_1star_room_2p',
  'hotel_2star_room_2p', 'hotel_3star_room_2p', 'hotel_4star_room_2p',
  'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'mcmeal_combo',
  'street_food_meal_1p', 'premium_restaurant_meal_2p', 'cappuccino_1',
  'domestic_draft_beer_1', 'cocktail_1', 'wine_glass_1', 'paid_attraction_adult_1',
  'half_day_group_activity_adult_1', 'full_day_premium_activity_adult_1',
];
const STATUSES = new Set(['found', 'not_found', 'class_absent', 'blocked']);
const UNITS = new Set([
  'per_person_item', 'per_two_person_meal', 'per_room_night', 'per_person_bed_night',
  'per_person_ticket', 'per_person_activity',
]);

function usage() {
  console.error('Usage: node scripts/run-city-cost-v5-one-call.mjs --provider openai|anthropic --model MODEL --city CITY --country COUNTRY [--api-key KEY] [--out FILE]');
  console.error('       node scripts/run-city-cost-v5-one-call.mjs --validate-file FILE');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    args[key] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return args;
}

function promptFor(city, country, referenceDate) {
  return fs.readFileSync(path.join(ROOT, PROMPT_PATH), 'utf8')
    .replaceAll('{{city}}', city)
    .replaceAll('{{country}}', country)
    .replaceAll('{{referenceDate}}', referenceDate);
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('response did not contain a JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

export function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['payload is not an object'];
  for (const key of ['city', 'country', 'referenceDate', 'directLookup', 'measures']) {
    if (!(key in payload)) errors.push(`missing top-level field: ${key}`);
  }
  const measures = payload.measures;
  if (!measures || typeof measures !== 'object' || Array.isArray(measures)) return [...errors, 'measures is not an object'];
  for (const measure of MEASURES) {
    const item = measures[measure];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`missing measure object: ${measure}`);
      continue;
    }
    if (!STATUSES.has(item.status)) errors.push(`${measure}: invalid status`);
    if (item.status === 'found') {
      if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value <= 0) errors.push(`${measure}: found value must be positive`);
      if (typeof item.currency !== 'string' || !item.currency.trim()) errors.push(`${measure}: found currency required`);
      if (!UNITS.has(item.unit)) errors.push(`${measure}: found unit invalid`);
      if (typeof item.sourceUrl !== 'string' || !/^https?:\/\//.test(item.sourceUrl)) errors.push(`${measure}: found sourceUrl required`);
      if (typeof item.retrievedAt !== 'string' || !item.retrievedAt.trim()) errors.push(`${measure}: found retrievedAt required`);
      if (typeof item.basis !== 'string' || !item.basis.trim()) errors.push(`${measure}: found basis required`);
    }
    if (item.status !== 'found' && item.value !== null) errors.push(`${measure}: non-found value must be null`);
  }
  const unexpected = Object.keys(measures).filter((key) => !MEASURES.includes(key));
  for (const key of unexpected) errors.push(`unexpected measure: ${key}`);
  return errors;
}

function summarizeProviderError(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.error || parsed?.message || text.slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
}

function citationUrls(value) {
  const found = [];
  const visit = (item) => {
    if (!item) return;
    if (typeof item === 'string' && /^https?:\/\//.test(item)) found.push(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (typeof item === 'object') Object.entries(item).forEach(([key, child]) => {
      if (['url', 'uri', 'source_url'].includes(key) || key === 'link') visit(child);
      else if (key === 'annotations' || key === 'sources' || key === 'groundingChunks') visit(child);
    });
  };
  visit(value);
  return [...new Set(found)];
}

async function requestOpenAi({ apiKey, model, system, user }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: system,
      input: user,
      max_output_tokens: 5000,
      store: false,
      text: { format: { type: 'json_object' } },
      tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`OpenAI Responses API ${response.status}: ${summarizeProviderError(body)}`);
  const data = JSON.parse(body);
  const output = Array.isArray(data.output) ? data.output : [];
  const text = output
    .filter((item) => item?.type === 'message')
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part?.type === 'output_text')
    .map((part) => part.text || '')
    .join('\n').trim();
  if (!text) throw new Error('OpenAI response contained no output text');
  return {
    provider: 'openai', model: data.model || model, text,
    searchRequests: output.filter((item) => item?.type === 'web_search_call').length,
    searchQueries: output.flatMap((item) => item?.type === 'web_search_call' && Array.isArray(item.queries) ? item.queries : []).filter((q) => typeof q === 'string'),
    citations: citationUrls(output), usage: data.usage || null, raw: data,
  };
}

async function requestAnthropic({ apiKey, model, system, user }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 5000,
      system,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: user }],
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Anthropic Messages API ${response.status}: ${summarizeProviderError(body)}`);
  const data = JSON.parse(body);
  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks.filter((block) => block?.type === 'text').map((block) => block.text || '').join('\n').trim();
  if (!text) throw new Error('Anthropic response contained no text output');
  return {
    provider: 'anthropic', model: data.model || model, text,
    searchRequests: Number(data.usage?.server_tool_use?.web_search_requests || blocks.filter((b) => b?.type === 'server_tool_use').length),
    searchQueries: blocks.filter((block) => block?.type === 'server_tool_use' && block.name === 'web_search').map((block) => block.input?.query).filter((q) => typeof q === 'string'),
    citations: citationUrls(blocks), usage: data.usage || null, raw: data,
  };
}

async function run() {
  const args = parseArgs(process.argv);
  if (args['validate-file']) {
    const payload = JSON.parse(fs.readFileSync(path.resolve(String(args['validate-file'])), 'utf8'));
    const errors = validatePayload(payload);
    console.log(JSON.stringify({ valid: errors.length === 0, errors }, null, 2));
    process.exitCode = errors.length ? 1 : 0;
    return;
  }
  if (!args.provider || !args.model || !args.city || !args.country) {
    usage();
    process.exitCode = 2;
    return;
  }
  const provider = String(args.provider);
  if (!['openai', 'anthropic'].includes(provider)) throw new Error('provider must be openai or anthropic');
  const apiKey = String(args['api-key'] || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || '').trim();
  if (!apiKey) throw new Error(`No ${provider} API key configured; no provider request was made.`);
  const referenceDate = String(args['reference-date'] || new Date().toISOString().slice(0, 10));
  const user = promptFor(String(args.city), String(args.country), referenceDate);
  const system = 'You are a careful web price extractor. Return valid JSON only. Never calculate or estimate a price.';
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = provider === 'openai'
    ? await requestOpenAi({ apiKey, model: String(args.model), system, user })
    : await requestAnthropic({ apiKey, model: String(args.model), system, user });
  const finishedAt = new Date().toISOString();
  const payload = parseJson(result.text);
  const validationErrors = validatePayload(payload);
  const report = {
    schemaVersion: 'city-cost-v5-one-call-report-v1',
    provider: result.provider,
    model: result.model,
    city: String(args.city),
    country: String(args.country),
    referenceDate,
    providerRequests: 1,
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    searchRequests: result.searchRequests,
    searchQueries: [...new Set(result.searchQueries)],
    citations: [...new Set(result.citations)],
    usage: result.usage,
    validation: { valid: validationErrors.length === 0, errors: validationErrors },
    payload,
  };
  const out = args.out ? path.resolve(String(args.out)) : path.join(ROOT, 'data', 'reference', 'v5', 'experiments', '001-one-call-harness', `${String(args.city).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${provider}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ out, providerRequests: 1, searchRequests: result.searchRequests, valid: validationErrors.length === 0, errors: validationErrors }, null, 2));
  if (validationErrors.length) process.exitCode = 1;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
