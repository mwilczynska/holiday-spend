// One-time contract migration for the all-19-tier M3 panel.
// It changes metadata and creates an empty sealed holdout work queue; it never
// reads the spent holdout observations.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/reference/v6/validation-manifest-v6.json');
const developmentPath = path.join(root, 'data/reference/v6/ground-truth/development-ledger.json');
const sealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const extensionPath = path.join(root, 'data/reference/v6/ground-truth/holdout-extension.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const development = JSON.parse(fs.readFileSync(developmentPath, 'utf8'));
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
const measures = manifest.groundTruthPanel.measuresPerCity;
const oldMeasures = [
  'hostel_dorm_bed_1p',
  'hostel_private_room_2p',
  'hotel_1star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
  'paid_attraction_adult_1',
];
const newMeasures = measures.filter((measure) => !oldMeasures.includes(measure));

if (development.schemaVersion !== 'city-cost-v6-ground-truth-ledger-v2') {
  throw new Error(`Expected the pre-expansion development ledger v2; got ${development.schemaVersion}`);
}
if (seal.schemaVersion !== 'city-cost-v6-ground-truth-holdout-seal-v1' || seal.status !== 'revealed_once') {
  throw new Error('Expected the already-spent v1 holdout seal before the per-measure migration.');
}

development.schemaVersion = 'city-cost-v6-ground-truth-ledger-v3';
development.requiredMeasures = measures;
development.sourcePolicy = {
  ...development.sourcePolicy,
  independentFoodDrinkGroundTruth: 'Official restaurant, cafe and bar menus or venue price lists; never Numbeo; Expatistan is cross-check only.',
  independentActivityGroundTruth: 'Official attraction and operator pages; never BudgetYourTrip.',
  selectionRules: manifest.groundTruthPanel.measureSelectionRules,
  allTierPanelDecision: '2026-08-10: expand from the accommodation-scoped six-measure panel to 17 measures so all 19 product tiers can be fitted and validated.',
};
development.observationContract = {
  ...development.observationContract,
  panelMedianFound: ['samplePrices', 'selectionRule'],
};
fs.writeFileSync(developmentPath, `${JSON.stringify(development, null, 2)}\n`);

const extension = {
  schemaVersion: 'city-cost-v6-ground-truth-holdout-extension-v1',
  methodologyVersion: manifest.methodologyVersion,
  manifestPath: 'data/reference/v6/validation-manifest-v6.json',
  panel: 'holdout-extension',
  referenceWindow: manifest.groundTruthPanel.referenceWindow,
  requiredMeasures: newMeasures,
  status: 'sealed_before_collection',
  cities: manifest.groundTruthPanel.lockedHoldout.cities.map((city) => ({
    city: city.city,
    region: city.region,
    band: city.band,
    observations: [],
  })),
};
fs.writeFileSync(extensionPath, `${JSON.stringify(extension, null, 2)}\n`);

const priorMeasures = Object.fromEntries(oldMeasures.map((measure) => [measure, {
  status: 'revealed_once',
  resultsFile: seal.resultsFile,
  scoresFile: seal.scoresFile,
  candidateConfigHash: seal.candidateConfigHash,
  candidateCommit: seal.candidateCommit,
  frozenAt: seal.frozenAt,
  revealedAt: seal.revealedAt,
}]));
const newMeasureState = Object.fromEntries(newMeasures.map((measure) => [measure, {
  status: 'sealed_before_collection',
  resultsFile: 'data/reference/v6/ground-truth/holdout-extension.json',
  scoresFile: null,
  candidateConfigHash: null,
  candidateCommit: null,
  frozenAt: null,
  revealedAt: null,
}]));

const migratedSeal = {
  schemaVersion: 'city-cost-v6-ground-truth-holdout-seal-v2',
  methodologyVersion: seal.methodologyVersion,
  manifestPath: seal.manifestPath,
  status: 'per_measure',
  cityCount: seal.cityCount,
  requiredMeasureCount: measures.length,
  lockRule: 'Per-measure seal. Existing revealed_once measures are spent. New measures are sealed before collection, revealed once only after the all-19 candidate is frozen, and may not be tuned or rescored.',
  measures: { ...priorMeasures, ...newMeasureState },
  migrationDecision: '2026-08-10 owner decision: treat the six already scored measures as spent while opening fresh per-measure slots for the eleven never-read measures; no old holdout observation was inspected by this migration.',
};
fs.writeFileSync(sealPath, `${JSON.stringify(migratedSeal, null, 2)}\n`);

console.log(JSON.stringify({
  schemaVersion: migratedSeal.schemaVersion,
  developmentSchemaVersion: development.schemaVersion,
  requiredMeasures: measures.length,
  newHoldoutMeasures: newMeasures.length,
  oldMeasuresRevealedOnce: oldMeasures.length,
  holdoutObservationsRead: false,
}, null, 2));
