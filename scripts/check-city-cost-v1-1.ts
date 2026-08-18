import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CITY_COST_V11_FX,
  materializeCityCostV11,
} from '@/lib/city-cost-methodology-v1-1';
import { assertV11OutputPathSafe, LIVE_CITY_COST_CSV_RELATIVE_PATH } from '@/lib/city-cost-v1-1-guard';

const liveCsvPath = path.resolve(process.cwd(), LIVE_CITY_COST_CSV_RELATIVE_PATH);
const liveCsvSha256 = createHash('sha256').update(fs.readFileSync(liveCsvPath)).digest('hex');
const expectedLiveCsvSha256 = '0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8';

if (liveCsvSha256 !== expectedLiveCsvSha256) {
  throw new Error(`Live v1 CSV hash changed: expected ${expectedLiveCsvSha256}, got ${liveCsvSha256}.`);
}

const fixture = {
  region: 'Europe' as const,
  confidence: 'medium' as const,
  confidence_notes: 'Deterministic check fixture.',
  comparable_city_reasoning: 'Deterministic check fixture.',
  anchors_usd: {
    beer: 2,
    coffee: 3,
    inexp_meal_1p: 10,
    midrange_meal_2p: 40,
    cocktail: 8,
    wine_glass: 6,
    hostel_dorm_1p: 12,
    hostel_private_2p: 30,
    hotel_1star_2p: 50,
    hotel_3star_2p: 100,
  },
};

const first = materializeCityCostV11(fixture);
const second = materializeCityCostV11(fixture);
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('v1.1 materialization is not deterministic.');
if (first.fx.audPerUsd !== CITY_COST_V11_FX.audPerUsd) throw new Error('v1.1 FX provenance is unstable.');
if (Object.keys(first.tiersAud).length !== 18) throw new Error('Expected all 18 derived v1 tier values.');
if (Object.keys(first.mappedEstimate).length !== 22) throw new Error('Expected the complete mapped planner output.');
if (first.tiersAud.accom_4_star !== Math.round(100 * 1.8 * CITY_COST_V11_FX.audPerUsd)) {
  throw new Error('The preserved v1 four-star formula changed.');
}

assertV11OutputPathSafe('data/reference/v1-1-staged/preview.json');
console.log(JSON.stringify({
  methodologyVersion: first.methodologyVersion,
  formulaVersion: first.formulaVersion,
  fxSnapshotId: first.fx.snapshotId,
  derivedTierCount: Object.keys(first.tiersAud).length,
  mappedFieldCount: Object.keys(first.mappedEstimate).length,
  liveCsvSha256,
}));
