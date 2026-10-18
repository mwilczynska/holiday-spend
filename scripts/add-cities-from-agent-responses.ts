/**
 * Add new cities to the library the way a user does ("Add city with LLM"), with the provider call
 * answered by an external agent (for example a Claude Code subagent) instead of an API key.
 *
 *   npx tsx scripts/add-cities-from-agent-responses.ts prompts --dir <dir> "Chongqing|China" ...
 *   npx tsx scripts/add-cities-from-agent-responses.ts persist --dir <dir> --model claude-haiku-5-5 --effort max
 *   npx tsx scripts/add-cities-from-agent-responses.ts persist --dir <dir> --provider openai --model gpt-6-luna \n *     --effort max --agent "Codex subagent"
 *   npx tsx scripts/add-cities-from-agent-responses.ts regenerate-prompts --dir <dir> [--all | cityId ...]
 *
 * `regenerate-prompts` writes the same prompt files for cities already in the library, from their stored name and
 * country (exactly what the app's Regenerate action sends). `persist` then calls the app's
 * `generateAndPersistCityEstimate` for those cities: a new active estimate replaces the city's values and the previous
 * estimate stays in its history (inactive) as a rollback.
 *
 * `prompts` writes <slug>.prompt.md: the exact system and user prompt the app sends for that city
 * (`buildCityGenerationAnchorPrompt` for the configured methodology, v1.2 by default). The agent writes its raw answer to
 * <slug>.response.json and what it actually looked up to <slug>.provenance.json:
 *   { "web_search_used": true, "urls": ["https://www.rba.gov.au/..."] }
 *
 * `persist` runs the real `resolveOrCreatePlannerCity` path for each answered city, so identity,
 * country checks, schema and RBA validation, v1 formulas, persistence, climate and photo collection
 * are exactly the app's. Only `runJsonPromptWithProvider` is answered from the files, and only when
 * the prompt the app builds is byte-identical to the one the agent was given. Provenance records the
 * model as "<model> (<agent>)", by default "Claude Code subagent". Cities only: no itinerary legs are created.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buildCityGenerationAnchorPrompt, getCityCostMethodologyVersion } from '../src/lib/city-generation';
import { setExternalJsonPromptRunner } from '../src/lib/city-llm-client';
import { resolveOrCreatePlannerCity } from '../src/lib/planner-city-resolution';
import { generateAndPersistCityEstimate } from '../src/lib/city-generation-service';
import { resolveLlmRuntimeDefaults } from '../src/lib/llm-request-limits';
import { getCityImageRow } from '../src/lib/city-image-service';
import { CITY_GENERATION_PROVIDERS, type CityGenerationProvider } from '../src/lib/city-generation-config';
import { db } from '../src/db';
import { cities, countries } from '../src/db/schema';
import { findExistingCountryForCanonical } from '../src/lib/country-metadata';

const SYSTEM_PROMPT = 'You are a careful travel cost estimation assistant. Return valid JSON only.';
const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const slug = (city: string, country: string) =>
  `${country}-${city}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
}

function writePrompts(dir: string, entries: string[]) {
  fs.mkdirSync(dir, { recursive: true });
  const countryRows = db.select({ id: countries.id, name: countries.name }).from(countries).all();
  for (const entry of entries) {
    const [cityName, requestedCountryName] = entry.split('|').map((part) => part.trim().replace(/\s+/g, ' '));
    if (!cityName || !requestedCountryName) throw new Error(`Expected "City|Country", got "${entry}".`);
    const resolved = findExistingCountryForCanonical(countryRows, { name: requestedCountryName });
    if (!resolved) throw new Error(`Unknown canonical country: "${requestedCountryName}".`);
    // Generation uses the selected database row's label, which may be an alias such as "UAE".
    const countryName = resolved.existing?.name ?? resolved.canonical.name;
    const methodology = getCityCostMethodologyVersion();
    if (methodology === 'v1') throw new Error('Agent-answered generation supports the v1.1 and v1.2 anchor contracts only.');
    const { prompt, promptVersion } = buildCityGenerationAnchorPrompt({ cityName, countryName }, methodology);
    const id = slug(cityName, requestedCountryName);
    fs.writeFileSync(path.join(dir, `${id}.prompt.json`), JSON.stringify({
      cityName, countryName, promptVersion, systemPrompt: SYSTEM_PROMPT, userPromptSha256: sha256(prompt),
    }, null, 2));
    fs.writeFileSync(path.join(dir, `${id}.prompt.md`), `# System prompt\n\n${SYSTEM_PROMPT}\n\n# User prompt\n\n${prompt}\n`);
    console.log(`${id}.prompt.md`);
  }
}

function writeRegeneratePrompts(dir: string, ids: string[], all: boolean) {
  fs.mkdirSync(dir, { recursive: true });
  const methodology = getCityCostMethodologyVersion();
  if (methodology === 'v1') throw new Error('Agent-answered generation supports the v1.1 and v1.2 anchor contracts only.');
  const countryNames = new Map(db.select({ id: countries.id, name: countries.name }).from(countries).all().map((row) => [row.id, row.name]));
  const rows = db.select({ id: cities.id, name: cities.name, countryId: cities.countryId }).from(cities).all()
    .filter((row) => all || ids.includes(row.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const missing = ids.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length) throw new Error(`Unknown city ids: ${missing.join(', ')}`);
  for (const row of rows) {
    const countryName = countryNames.get(row.countryId);
    if (!countryName) throw new Error(`City ${row.id} has no country row.`);
    // The app's Regenerate action builds the prompt from the stored city and country names.
    const { prompt, promptVersion } = buildCityGenerationAnchorPrompt({ cityName: row.name, countryName }, methodology);
    fs.writeFileSync(path.join(dir, `${row.id}.prompt.json`), JSON.stringify({
      cityId: row.id, cityName: row.name, countryName, promptVersion, systemPrompt: SYSTEM_PROMPT, userPromptSha256: sha256(prompt),
    }, null, 2));
    fs.writeFileSync(path.join(dir, `${row.id}.prompt.md`), `# System prompt\n\n${SYSTEM_PROMPT}\n\n# User prompt\n\n${prompt}\n`);
  }
  console.log(`Wrote ${rows.length} regeneration prompts (${methodology}) to ${dir}`);
}

async function persist(dir: string, provider: CityGenerationProvider, model: string, effort: string, agent: string) {
  const ids = fs.readdirSync(dir).filter((file) => file.endsWith('.prompt.json')).map((file) => file.replace(/\.prompt\.json$/, '')).sort();
  for (const id of ids) {
    const resultPath = path.join(dir, `${id}.result.json`);
    const responsePath = path.join(dir, `${id}.response.json`);
    if (fs.existsSync(resultPath) && JSON.parse(fs.readFileSync(resultPath, 'utf8')).ok) continue;
    if (!fs.existsSync(responsePath)) { console.log(`skip   ${id}: no response yet`); continue; }
    const meta = JSON.parse(fs.readFileSync(path.join(dir, `${id}.prompt.json`), 'utf8'));
    const provenancePath = path.join(dir, `${id}.provenance.json`);
    const provenance = fs.existsSync(provenancePath) ? JSON.parse(fs.readFileSync(provenancePath, 'utf8')) : {};
    const text = fs.readFileSync(responsePath, 'utf8');

    setExternalJsonPromptRunner(async (params) => {
      if (params.systemPrompt !== meta.systemPrompt || sha256(params.userPrompt) !== meta.userPromptSha256) {
        throw new Error('The prompt the app built differs from the one the agent answered; not using this response.');
      }
      return {
        provider,
        model: `${model} (${agent})`,
        text,
        webSearchUsed: provenance.web_search_used === true,
        reasoningEffort: effort as never,
      };
    });
    try {
      if (meta.cityId) {
        const regenerated = await generateAndPersistCityEstimate({
          cityId: meta.cityId,
          provider,
          model,
          reasoningEffort: effort as never,
          runtimeSettings: resolveLlmRuntimeDefaults(),
        });
        const result = { ok: true, regenerated: true, cityId: meta.cityId, methodologyVersion: regenerated.methodologyVersion ?? null };
        fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
        console.log(`regenerated ${meta.cityName}, ${meta.countryName}`);
        continue;
      }
      const city = await resolveOrCreatePlannerCity({
        cityName: meta.cityName,
        countryName: meta.countryName,
        provider,
        model,
        reasoningEffort: effort as never,
        runtimeSettings: resolveLlmRuntimeDefaults(),
      });
      const image = getCityImageRow(city.cityId);
      const result = {
        ok: city.generatedCity,
        reusedExistingCity: city.reusedExistingCity,
        cityId: city.cityId, cityName: city.cityName, countryName: city.countryName,
        climateStatus: city.climateStatus ?? null,
        imageStatus: image?.status ?? null,
        fxUrls: provenance.urls ?? [],
      };
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
      console.log(`${result.ok ? 'added ' : 'exists'} ${city.cityName}, ${city.countryName}: climate ${result.climateStatus}, photo ${result.imageStatus}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fs.writeFileSync(resultPath, JSON.stringify({ ok: false, error: message }, null, 2));
      console.log(`FAILED ${meta.cityName}, ${meta.countryName}: ${message}`);
    } finally {
      setExternalJsonPromptRunner(null);
    }
  }
}

const [command] = process.argv.slice(2);
const dir = arg('--dir');
if (!dir) throw new Error('--dir is required.');
if (command === 'prompts') {
  writePrompts(dir, process.argv.slice(2).filter((value, index, all) => index > 0 && all[index - 1] !== '--dir' && value !== '--dir'));
} else if (command === 'regenerate-prompts') {
  const rest = process.argv.slice(3).filter((value, index, all) => value !== '--dir' && all[index - 1] !== '--dir' && value !== '--all');
  writeRegeneratePrompts(dir, rest, process.argv.includes('--all'));
} else if (command === 'persist') {
  const provider = (arg('--provider') ?? 'anthropic') as CityGenerationProvider;
  if (!CITY_GENERATION_PROVIDERS.includes(provider)) throw new Error(`--provider must be one of ${CITY_GENERATION_PROVIDERS.join(', ')}.`);
  persist(dir, provider, arg('--model') ?? 'claude-haiku-5-5', arg('--effort') ?? 'max', arg('--agent') ?? 'Claude Code subagent').catch((error) => { console.error(error); process.exit(1); });
} else {
  throw new Error('Usage: prompts|regenerate-prompts|persist --dir <dir> ...');
}
