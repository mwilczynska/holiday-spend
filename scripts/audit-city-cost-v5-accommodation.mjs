// Experiment 002: independently summarize the retained accommodation ladder
// evidence. This is deliberately a report generator, not an acceptance claim.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INPUT_LADDER = 'data/reference/dry-run/phase-0h-accommodation-class-ratios.json';
const INPUT_ANALYSIS = 'data/reference/dry-run/phase-0g-stage1-analysis.json';
const OUT = path.join(ROOT, 'data', 'reference', 'v5', 'experiments', '002-accommodation-ladder', 'results.json');

const ladder = JSON.parse(fs.readFileSync(path.join(ROOT, INPUT_LADDER), 'utf8'));
const analysis = JSON.parse(fs.readFileSync(path.join(ROOT, INPUT_ANALYSIS), 'utf8'));

const relations = ladder.relations.map((relation) => ({
  label: relation.label,
  n: relation.n,
  ratio: relation.ratio,
  selected: relation.selected,
  leaveOneOutMedianApePct: relation.performance.R0.loo,
  holdoutMedianApePct: relation.performance.R0.holdout,
  holdoutCities: relation.performance.holdoutCities,
}));

const report = {
  schemaVersion: 'city-cost-v5-accommodation-audit-v1',
  experiment: '002-accommodation-ladder',
  sourceArtifacts: [INPUT_LADDER, INPUT_ANALYSIS],
  sample: {
    hotelClassRatioCities: ladder.cityCount,
    hostelBlendedRatioCities: relations.find((relation) => relation.label.startsWith('hostel_blended'))?.n ?? 0,
    requiredCompleteMatchedCitiesForV5: 30,
    requiredLockedHoldoutCitiesForMultiTierClaim: 10,
  },
  relations,
  estimatorStability: {
    firstPageWindowSpread: analysis.q1_depth.windowSpread,
    headlineVsList: analysis.q3_headline,
    independentCopenhagenCheck: ladder.independentCheck,
  },
  identifiability: {
    hostelChannelMeasure: 'hostel_blended',
    dormDirectEvidenceCities: 0,
    privateRoomDirectEvidenceCities: 0,
    conclusion: 'The blended hostel channel cannot identify dorm and private-room tiers separately.',
  },
  verdict: {
    status: 'reject-as-final-model; retain-as-candidate-evidence',
    reasons: [
      'Hotel ladder sample n=16 is below the v5 complete-matched-city requirement of 30.',
      'Hostel ratio is a blended unit and cannot support two separately named hostel tiers.',
      'First-page windows vary by up to 3.945x in the only full-inventory check.',
      'Headline averages vary from 0.451x to 1.834x of list medians in the retained sample.',
      'One Copenhagen independent check cannot establish a general level correction.',
    ],
    nextExperiment: 'Collect independent, definition-matched accommodation ground truth across at least 30 cities and test a source that labels occupancy.'
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
