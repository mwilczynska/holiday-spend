import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { materializeCityCostV11 } from '@/lib/city-cost-methodology-v1-1';
import { CITY_COST_V12_CORRECTION_VERSION, materializeCityCostV12 } from '@/lib/city-cost-methodology-v1-2';
import corrections from '@/lib/data/city-cost-corrections-v1-2.json';
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
  fx: {
    as_of_date: '2026-08-25',
    source_name: 'Reserve Bank of Australia',
    source_url: 'https://www.rba.gov.au/statistics/frequency/exchange-rates.html',
    source_rate: 0.7,
    source_rate_basis: 'USD_PER_AUD' as const,
  },
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

const checkDate = new Date('2026-08-26T12:00:00Z');
const first = materializeCityCostV11(fixture, checkDate);
const second = materializeCityCostV11(fixture, checkDate);
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('v1.1 materialization is not deterministic.');
if (first.fx.audPerUsd !== 1.428571) throw new Error('v1.1 FX inversion is unstable.');
if (Object.keys(first.tiersAud).length !== 19) throw new Error('Expected all 19 persisted v1 planner fields.');
if (first.tiersAud.drink_coffee !== first.anchorsAud.coffee) throw new Error('Direct coffee field lost cent precision.');
if (Object.keys(first.mappedEstimate).length !== 22) throw new Error('Expected the complete mapped planner output.');
if (first.tiersAud.accom_4_star !== Math.round(100 * 1.8 * first.fx.audPerUsd)) {
  throw new Error('The preserved v1 four-star formula changed.');
}

// v1.2: the correction table covers exactly the owner-approved anchors, every factor is plausible, and corrected
// anchors flow through the unchanged v1.1 materialization (so 4-star follows the corrected 3-star).
const CORRECTED = [
  'inexp_meal_1p', 'midrange_meal_2p', 'beer', 'coffee', 'hotel_3star_2p', 'hotel_1star_2p', 'hostel_dorm_1p', 'hostel_private_2p',
];
if (JSON.stringify([...corrections.correctedAnchors].sort()) !== JSON.stringify([...CORRECTED].sort())) {
  throw new Error(`v1.2 corrected anchors changed: ${corrections.correctedAnchors.join(', ')}`);
}
const factors: number[] = [];
for (const anchor of CORRECTED) {
  factors.push((corrections.global as Record<string, number>)[anchor]);
  for (const f of Object.values((corrections.region as Record<string, Record<string, number>>)[anchor])) factors.push(f);
  for (const c of Object.values((corrections.country as Record<string, Record<string, { factor: number }>>)[anchor])) factors.push(c.factor);
}
if (factors.some((f) => !Number.isFinite(f) || f < 0.2 || f > 3)) throw new Error('v1.2 correction factor outside 0.2-3.');
const v12 = materializeCityCostV12(fixture, { countryName: 'Italy' }, checkDate);
const v12Reference = materializeCityCostV11({ ...fixture, anchors_usd: v12.anchorsUsd }, checkDate);
if (JSON.stringify(v12.tiersAud) !== JSON.stringify(v12Reference.tiersAud)) throw new Error('v1.2 must reuse the v1.1 materialization.');
if (v12.anchorsUsd.cocktail !== fixture.anchors_usd.cocktail) throw new Error('v1.2 must not correct cocktails.');

assertV11OutputPathSafe('data/reference/v1-1-staged/preview.json');
console.log(JSON.stringify({
  v12CorrectionVersion: CITY_COST_V12_CORRECTION_VERSION,
  v12CorrectionFactors: factors.length,
  methodologyVersion: first.methodologyVersion,
  formulaVersion: first.formulaVersion,
  fxSnapshotId: first.fx.snapshotId,
  plannerFieldCount: Object.keys(first.tiersAud).length,
  derivedDailyTierCount: Object.keys(first.tiersAud).length - 1,
  mappedFieldCount: Object.keys(first.mappedEstimate).length,
  liveCsvSha256,
}));
