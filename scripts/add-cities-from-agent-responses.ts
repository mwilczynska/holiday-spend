/**
 * Add new cities to the library the way a user does ("Add city with LLM"), with the provider call
 * answered by an external agent (for example a Claude Code subagent) instead of an API key.
 *
 *   npx tsx scripts/add-cities-from-agent-responses.ts prompts --dir <dir> "Chongqing|China" ...
 *   npx tsx scripts/add-cities-from-agent-responses.ts persist --dir <dir> --model claude-haiku-5-5 --effort max
 *
 * `prompts` writes <slug>.prompt.md: the exact system and user prompt the app sends for that city
 * (`buildCityGenerationV11Prompt`, the active v1.1 contract). The agent writes its raw answer to
 * <slug>.response.json and what it actually looked up to <slug>.provenance.json:
 *   { "web_search_used": true, "urls": ["https://www.rba.gov.au/..."] }
 *
 * `persist` runs the real `resolveOrCreatePlannerCity` path for each answered city, so identity,
 * country checks, schema and RBA validation, v1 formulas, persistence, climate and photo collection
 * are exactly the app's. Only `runJsonPromptWithProvider` is answered from the files, and only when
 * the prompt the app builds is byte-identical to the one the agent was given. Provenance records the
 * model as "<model> (Claude Code subagent)". Cities only: no itinerary legs are created.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buildCityGenerationV11Prompt } from '../src/lib/city-generation';
import { setExternalJsonPromptRunner } from '../src/lib/city-llm-client';
import { resolveOrCreatePlannerCity } from '../src/lib/planner-city-resolution';
import { resolveLlmRuntimeDefaults } from '../src/lib/llm-request-limits';
import { getCityImageRow } from '../src/lib/city-image-service';

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
  for (const entry of entries) {
    const [cityName, countryName] = entry.split('|').map((part) => part.trim());
    if (!cityName || !countryName) throw new Error(`Expected "City|Country", got "${entry}".`);
    const { prompt, promptVersion } = buildCityGenerationV11Prompt({ cityName, countryName } as Parameters<typeof buildCityGenerationV11Prompt>[0]);
    const id = slug(cityName, countryName);
    fs.writeFileSync(path.join(dir, `${id}.prompt.json`), JSON.stringify({
      cityName, countryName, promptVersion, systemPrompt: SYSTEM_PROMPT, userPromptSha256: sha256(prompt),
    }, null, 2));
    fs.writeFileSync(path.join(dir, `${id}.prompt.md`), `# System prompt\n\n${SYSTEM_PROMPT}\n\n# User prompt\n\n${prompt}\n`);
    console.log(`${id}.prompt.md`);
  }
}

async function persist(dir: string, model: string, effort: string) {
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
        provider: 'anthropic',
        model: `${model} (Claude Code subagent)`,
        text,
        webSearchUsed: provenance.web_search_used === true,
        reasoningEffort: effort as never,
      };
    });
    try {
      const city = await resolveOrCreatePlannerCity({
        cityName: meta.cityName,
        countryName: meta.countryName,
        provider: 'anthropic',
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
} else if (command === 'persist') {
  persist(dir, arg('--model') ?? 'claude-haiku-5-5', arg('--effort') ?? 'max').catch((error) => { console.error(error); process.exit(1); });
} else {
  throw new Error('Usage: prompts|persist --dir <dir> ...');
}
