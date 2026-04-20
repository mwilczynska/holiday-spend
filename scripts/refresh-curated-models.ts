import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CITY_GENERATION_PROVIDERS,
  type CityGenerationProvider,
  type CuratedModelsSnapshot,
} from '../src/lib/city-generation-config';
import { fetchAggregatedProviderModelIds } from '../src/lib/provider-model-discovery';

const OUTPUT_PATH = resolve(process.cwd(), 'src/lib/data/curated-models.generated.json');
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

async function loadExistingSnapshot(): Promise<CuratedModelsSnapshot | null> {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    return JSON.parse(raw) as CuratedModelsSnapshot;
  } catch {
    return null;
  }
}

function snapshotsAreEquivalent(a: CuratedModelsSnapshot, b: CuratedModelsSnapshot) {
  for (const provider of CITY_GENERATION_PROVIDERS) {
    const left = a.providers[provider].join(',');
    const right = b.providers[provider].join(',');
    if (left !== right) return false;
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

  const nextSnapshot: CuratedModelsSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(
      successes.map((entry) => [entry.provider, entry.aggregatorSource])
    ) as CuratedModelsSnapshot['sources'],
    providers: Object.fromEntries(
      successes.map((entry) => [entry.provider, entry.modelIds])
    ) as CuratedModelsSnapshot['providers'],
  };

  if (mode === 'check') {
    const existing = await loadExistingSnapshot();
    if (!existing) {
      console.error('[refresh-curated-models] No existing snapshot found. Run `npm run models:refresh` to generate one.');
      process.exitCode = 1;
      return;
    }

    if (!snapshotsAreEquivalent(existing, nextSnapshot)) {
      console.error('[refresh-curated-models] Snapshot is stale compared to upstream aggregators.');
      for (const provider of CITY_GENERATION_PROVIDERS) {
        console.error(`  ${provider}:`);
        console.error(`    snapshot: ${existing.providers[provider].join(', ')}`);
        console.error(`    upstream: ${nextSnapshot.providers[provider].join(', ')}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('[refresh-curated-models] Snapshot matches upstream aggregators.');
    return;
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(nextSnapshot, null, 2) + '\n', 'utf8');
  console.log(`[refresh-curated-models] Wrote ${OUTPUT_PATH}`);
  for (const provider of CITY_GENERATION_PROVIDERS) {
    console.log(
      `  ${provider} (${nextSnapshot.sources[provider]}): ${nextSnapshot.providers[provider].join(', ')}`
    );
  }
}

main().catch((err) => {
  console.error('[refresh-curated-models] Unhandled error:', err);
  process.exit(1);
});
