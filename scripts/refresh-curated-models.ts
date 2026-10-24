import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CITY_GENERATION_PROVIDERS,
  CITY_GENERATION_REASONING_EFFORTS,
  type CityGenerationProvider,
  type CuratedModelsSnapshot,
  type ModelReasoningEffortsSnapshot,
} from '../src/lib/city-generation-config';
import { LLM_PROVIDER_SPECS } from '../src/lib/llm-provider-registry';
import {
  DEFAULT_MODEL_RULES,
  chooseDefaultModel,
  mergeRetiredDefaults,
  readModelsDevCatalogue,
} from '../src/lib/model-default-selection';
import { fetchAggregatedProviderModelIds, translateAggregatorModelId } from '../src/lib/provider-model-discovery';

const OUTPUT_PATH = resolve(process.cwd(), 'src/lib/data/curated-models.generated.json');
const EFFORTS_OUTPUT_PATH = resolve(process.cwd(), 'src/lib/data/model-reasoning-efforts.generated.json');
const SUGGESTIONS_PER_PROVIDER = 8;

type Mode = 'refresh' | 'check';

function parseMode(argv: string[]): Mode {
  if (argv.includes('--check')) return 'check';
  return 'refresh';
}

async function buildProviderSnapshot(provider: CityGenerationProvider) {
  const aggregated = await fetchAggregatedProviderModelIds(provider);
  return {
    provider,
    aggregatorSource: aggregated.aggregatorSource,
    modelIds: aggregated.modelIds.slice(0, SUGGESTIONS_PER_PROVIDER),
  };
}

/**
 * Reasoning efforts per model from OpenRouter's public model list, which publishes each model's
 * `reasoning.supported_efforts`. `minimal` has no equivalent in this app and is dropped. Keyed by
 * the provider's own model ID; OpenRouter's own entries keep the full slug.
 */
async function buildReasoningEffortsSnapshot(): Promise<ModelReasoningEffortsSnapshot> {
  const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`OpenRouter model list failed with HTTP ${response.status}.`);
  const payload = await response.json() as {
    data?: Array<{ id?: string; reasoning?: { supported_efforts?: string[] } }>;
  };
  const known = new Set<string>(CITY_GENERATION_REASONING_EFFORTS);
  const providers: ModelReasoningEffortsSnapshot['providers'] = {};

  for (const row of payload.data ?? []) {
    const slug = row.id?.trim();
    const efforts = (row.reasoning?.supported_efforts ?? []).filter((effort) => known.has(effort));
    if (!slug || slug.includes(':') || efforts.length === 0) continue;
    const ordered = CITY_GENERATION_REASONING_EFFORTS.filter((effort) => efforts.includes(effort));

    for (const provider of CITY_GENERATION_PROVIDERS) {
      const prefix = LLM_PROVIDER_SPECS[provider].openRouterPrefix;
      if (prefix === null || !slug.startsWith(prefix)) continue;
      const modelId = provider === 'openrouter' ? slug : translateAggregatorModelId(provider, slug.slice(prefix.length));
      (providers[provider] ??= {})[modelId] = ordered;
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(providers).map(([provider, table]) => [
      provider,
      Object.fromEntries(Object.entries(table!).sort(([left], [right]) => left.localeCompare(right))),
    ])
  ) as ModelReasoningEffortsSnapshot['providers'];

  return { schemaVersion: 1, generatedAt: new Date().toISOString(), source: 'openrouter', providers: sorted };
}

async function loadExistingSnapshot(): Promise<CuratedModelsSnapshot | null> {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    return JSON.parse(raw) as CuratedModelsSnapshot;
  } catch {
    return null;
  }
}

/**
 * Chooses each provider's cheap, fast default from models.dev release dates and prices. A provider
 * whose rule matches nothing keeps its previous default, so a catalogue gap never empties a default.
 * OpenRouter mirrors the OpenAI default.
 */
async function buildDefaultModels(existing: CuratedModelsSnapshot | null) {
  const response = await fetch('https://models.dev/api.json', { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`models.dev failed with HTTP ${response.status}.`);
  const payload = await response.json();
  const previous = Object.fromEntries(
    CITY_GENERATION_PROVIDERS.map((provider) => [
      provider,
      existing?.defaults?.[provider] ?? LLM_PROVIDER_SPECS[provider].defaultModel,
    ])
  ) as Record<CityGenerationProvider, string>;

  const defaults = { ...previous };
  for (const provider of CITY_GENERATION_PROVIDERS) {
    const rule = DEFAULT_MODEL_RULES[provider];
    const modelsDevKey = LLM_PROVIDER_SPECS[provider].modelsDevKey;
    if (!rule || !modelsDevKey) continue;
    const chosen = chooseDefaultModel(rule, readModelsDevCatalogue(payload, modelsDevKey));
    if (chosen) defaults[provider] = chosen;
    else console.warn(`[refresh-curated-models] ${provider}: no model matches ${rule.pattern}; keeping ${previous[provider]}.`);
  }
  defaults.openrouter = `openai/${defaults.openai}`;

  return {
    defaults,
    retiredDefaults: mergeRetiredDefaults(previous, defaults, existing?.retiredDefaults ?? {}),
  };
}

function snapshotsAreEquivalent(a: CuratedModelsSnapshot, b: CuratedModelsSnapshot) {
  for (const provider of CITY_GENERATION_PROVIDERS) {
    const left = (a.providers[provider] ?? []).join(',');
    const right = (b.providers[provider] ?? []).join(',');
    if (left !== right) return false;
    if (a.defaults?.[provider] !== b.defaults?.[provider]) return false;
  }
  return true;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));

  const results = await Promise.all(
    CITY_GENERATION_PROVIDERS.map((provider) =>
      buildProviderSnapshot(provider).catch((err) => ({
        provider,
        error: err instanceof Error ? err.message : String(err),
      }))
    )
  );

  const failures = results.filter((entry): entry is { provider: CityGenerationProvider; error: string } => 'error' in entry);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[refresh-curated-models] ${failure.provider} failed: ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  const successes = results as Array<{
    provider: CityGenerationProvider;
    aggregatorSource: string;
    modelIds: string[];
  }>;

  const emptyProviders = successes.filter((entry) => entry.modelIds.length === 0);
  if (emptyProviders.length > 0) {
    for (const entry of emptyProviders) {
      console.error(
        `[refresh-curated-models] ${entry.provider} produced zero usable models from ${entry.aggregatorSource}.`
      );
    }
    process.exitCode = 1;
    return;
  }

  const existing = await loadExistingSnapshot();
  const { defaults, retiredDefaults } = await buildDefaultModels(existing);
  const nextSnapshot: CuratedModelsSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(
      successes.map((entry) => [entry.provider, entry.aggregatorSource])
    ) as CuratedModelsSnapshot['sources'],
    providers: Object.fromEntries(
      successes.map((entry) => [entry.provider, entry.modelIds])
    ) as CuratedModelsSnapshot['providers'],
    defaults,
    retiredDefaults,
  };

  if (mode === 'check') {
    if (!existing) {
      console.error('[refresh-curated-models] No existing snapshot found. Run `npm run models:refresh` to generate one.');
      process.exitCode = 1;
      return;
    }

    if (!snapshotsAreEquivalent(existing, nextSnapshot)) {
      console.error('[refresh-curated-models] Snapshot is stale compared to upstream aggregators.');
      for (const provider of CITY_GENERATION_PROVIDERS) {
        console.error(`  ${provider}:`);
        console.error(`    snapshot: ${(existing.providers[provider] ?? []).join(', ')}`);
        console.error(`    upstream: ${(nextSnapshot.providers[provider] ?? []).join(', ')}`);
        console.error(`    default: ${existing.defaults?.[provider] ?? '(none)'} -> ${defaults[provider]}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('[refresh-curated-models] Snapshot matches upstream aggregators.');
    return;
  }

  const effortsSnapshot = await buildReasoningEffortsSnapshot();
  await writeFile(OUTPUT_PATH, JSON.stringify(nextSnapshot, null, 2) + '\n', 'utf8');
  await writeFile(EFFORTS_OUTPUT_PATH, JSON.stringify(effortsSnapshot, null, 2) + '\n', 'utf8');
  console.log(`[refresh-curated-models] Wrote ${OUTPUT_PATH} and ${EFFORTS_OUTPUT_PATH}`);
  for (const provider of CITY_GENERATION_PROVIDERS) {
    console.log(
      `  ${provider} (${nextSnapshot.sources[provider]}): default ${defaults[provider]}; ${(nextSnapshot.providers[provider] ?? []).join(', ')}`
    );
  }
  for (const [provider, retired] of Object.entries(retiredDefaults)) {
    console.log(`  retired defaults ${provider}: ${retired!.join(', ')}`);
  }
  for (const [provider, table] of Object.entries(effortsSnapshot.providers)) {
    console.log(`  efforts ${provider}: ${Object.keys(table!).length} models`);
  }
}

main().catch((err) => {
  console.error('[refresh-curated-models] Unhandled error:', err);
  process.exit(1);
});
