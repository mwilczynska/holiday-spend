// Combines repeated runs of the city-cost-anchors-v4 prompt into one record by
// per-measure median, and reports what k-sample repetition actually buys.
//
// The question this answers: accommodation collection is high-variance (§9.4.3),
// with one city returning 6/6 classes on one run and 2/6 on another. Repetition
// is the obvious lever, but its value has to be measured rather than assumed —
// both for coverage (how many classes get priced at all) and for agreement
// (how far the samples are from each other where they do agree).
//
// Values are converted to the city's currency before combining, since a measure
// may legitimately arrive in whatever currency its source displayed.

import fs from 'node:fs';

const DIR = process.env.TEST_DIR;
const CITY = process.env.CITY ?? 'Prague';
const CURRENCY = process.env.CITY_CURRENCY ?? 'CZK';
const FILES = (process.env.SAMPLE_FILES ?? '').split(',').filter(Boolean);

const FX = JSON.parse(
  fs.readFileSync('data/reference/fx/city_cost_fx_aud_2026-07-22.json', 'utf8')
).rates;

const toCity = (v, from) => {
  if (!from || from === CURRENCY) return v;
  const a = FX[from]?.audPerUnit;
  const b = FX[CURRENCY]?.audPerUnit;
  return a && b ? (v * a) / b : null;
};

const MEASURES = [
  'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'mcmeal_combo',
  'domestic_draft_beer_1', 'cappuccino_1',
  'hostel_dorm_bed_1p', 'hostel_private_room_2p',
  'hotel_1star_room_2p', 'hotel_2star_room_2p', 'hotel_3star_room_2p', 'hotel_4star_room_2p',
  'paid_attraction_adult_1', 'half_day_group_activity_adult_1', 'full_day_premium_activity_adult_1',
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const samples = FILES.map((f) => ({ file: f, json: JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8')) }));

// Combine the first k samples, for k = 1..n, so the marginal value of each
// additional sample is visible rather than only the endpoint.
function combine(k) {
  const use = samples.slice(0, k);
  const out = { k, measures: {}, priced: 0, accommodationPriced: 0 };
  for (const measure of MEASURES) {
    const vals = [];
    for (const s of use) {
      const m = s.json.measures?.[measure];
      if (!m || m.status !== 'found' || typeof m.value !== 'number') continue;
      const v = toCity(m.value, m.currency);
      if (v !== null) vals.push(v);
    }
    if (!vals.length) { out.measures[measure] = { status: 'not_found', foundIn: 0, of: k }; continue; }
    const med = median(vals);
    // Dispersion across samples is the confidence signal a searched city gets,
    // playing the role the contributor count plays for a looked-up one.
    const spread = Math.max(...vals) / Math.min(...vals);
    out.measures[measure] = {
      status: 'found', value: +med.toFixed(2), foundIn: vals.length, of: k,
      spreadFactor: +spread.toFixed(2),
      samples: vals.map((v) => +v.toFixed(2)),
    };
    out.priced++;
    if (measure.startsWith('hostel_') || measure.startsWith('hotel_')) out.accommodationPriced++;
  }
  const acc = ['hostel_dorm_bed_1p', 'hostel_private_room_2p', 'hotel_1star_room_2p',
    'hotel_2star_room_2p', 'hotel_3star_room_2p', 'hotel_4star_room_2p']
    .map((m) => (out.measures[m].status === 'found' ? out.measures[m].value : null));
  const present = acc.filter((v) => v !== null);
  let monotonic = true;
  for (let i = 1; i < present.length; i++) if (present[i] < present[i - 1]) monotonic = false;
  out.ladder = acc;
  out.monotonic = monotonic;
  out.hasThreeStar = out.measures.hotel_3star_room_2p.status === 'found';
  out.usable = monotonic && out.accommodationPriced >= 3 && out.hasThreeStar;
  return out;
}

const report = {
  city: CITY, currency: CURRENCY, sampleCount: samples.length,
  perSample: samples.map((s) => ({
    file: s.file,
    directLookup: s.json.directLookup?.outcome ?? null,
    found: MEASURES.filter((m) => s.json.measures?.[m]?.status === 'found').length,
    accommodationFound: MEASURES.filter((m) => (m.startsWith('hostel_') || m.startsWith('hotel_'))
      && s.json.measures?.[m]?.status === 'found').length,
  })),
  byK: [],
};
for (let k = 1; k <= samples.length; k++) report.byK.push(combine(k));

fs.writeFileSync(`${DIR}/combined-${CITY.toLowerCase().replace(/\s+/g, '-')}.json`,
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
