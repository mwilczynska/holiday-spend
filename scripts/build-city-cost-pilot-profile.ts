import fs from 'node:fs';
import path from 'node:path';
import { cityCostPilotEnrichmentSchema } from '../src/lib/city-cost-pilot-enrichment';
import { buildCityCostPilotProfile } from '../src/lib/city-cost-pilot-profile';

const root = process.cwd();
const enrichmentPath = path.join(root, 'data/reference/city_cost_pilot_enrichment.json');
const datasetPath = path.join(root, 'data/reference/materialized/city_costs_v3_alpha.json');
const outputPath = path.join(root, 'data/reference/materialized/city_cost_pilot_profile.json');
const check = process.argv.includes('--check');

const enrichment = cityCostPilotEnrichmentSchema.parse(JSON.parse(fs.readFileSync(enrichmentPath, 'utf8')));
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const profile = buildCityCostPilotProfile(enrichment, dataset);
const serialized = `${JSON.stringify(profile, null, 2)}\n`;

if (check) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== serialized) {
    throw new Error('Pilot profile is stale; run npm run methodology:pilot:profile');
  }
} else {
  fs.writeFileSync(outputPath, serialized, 'utf8');
}

console.log(JSON.stringify({ valid: true, mode: check ? 'check' : 'write', ...profile.modelReadiness,
  pilotCityCount: profile.pilotCityCount, materializedTierCells: profile.materializedTierCells,
  requiredTierCells: profile.requiredTierCells, coveragePct: profile.materializedTierCoveragePct }, null, 2));
