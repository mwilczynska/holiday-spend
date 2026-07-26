// Estimates the bias in aggregator headline averages against direct
// property quotes, for the 4-star class.
//
// The +54% figure in §9.4.4 rests on one city. This script pools every city
// with direct quotes so the question becomes: is the inflation a stable,
// correctable offset, or does it vary too much between cities to correct?
//
// Bias is computed as a log ratio and reported as a multiplier, because price
// error is multiplicative — a source 2x high and one 2x low should average to
// no bias, which log space gives and percentage space does not.

import fs from 'node:fs';

const DIR = process.env.TEST_DIR;
const FX = JSON.parse(
  fs.readFileSync('data/reference/fx/city_cost_fx_aud_2026-07-22.json', 'utf8')
).rates;

const toAud = (v, cur) => {
  const r = FX[cur]?.audPerUnit;
  return r ? v * r : null;
};

// Headline averages already collected from booking.com class pages, with the
// currency each page displayed. These are the values the contract now ships.
const HEADLINE = {
  Copenhagen: { value: 334, currency: 'USD' },
  Prague: { value: 198, currency: 'USD' },
  Hanoi: { value: null, currency: null },
  Lisbon: { value: null, currency: null },
};

// Copenhagen's ground truth predates this run: five accepted direct-property
// quotes from the v3 programme, retained in the observation store.
const PRIOR_QUOTES = {
  Copenhagen: {
    currency: 'DKK',
    prices: [1652.57, 1178.36, 1417.428571, 1738.928571, 1365.285714],
    provenance: 'v3 accommodation panel, official booking engines, 90-day lead, shoulder season',
  },
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const cities = {};

// Prior ground truth
for (const [city, g] of Object.entries(PRIOR_QUOTES)) {
  cities[city] = {
    city,
    quotes: g.prices.map((p) => ({ price: p, currency: g.currency })),
    provenance: g.provenance,
  };
}

// Newly collected ground truth
for (const f of fs.readdirSync(DIR).filter((x) => /^gt-.*-4star\.json$/.test(x))) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'));
  } catch {
    continue;
  }
  const qs = (j.quotes ?? []).filter((q) => typeof q.nightlyPrice === 'number' && q.nightlyPrice > 0);
  if (!qs.length) {
    cities[j.city] = { city: j.city, quotes: [], provenance: 'collection returned no usable quotes' };
    continue;
  }
  cities[j.city] = {
    city: j.city,
    quotes: qs.map((q) => ({ price: q.nightlyPrice, currency: q.currency, hotel: q.hotelName })),
    provenance: `direct official-site collection, ${j.attemptsMade ?? '?'} attempts`,
  };
}

const report = { starClass: 4, cities: [], pooled: {} };
const logRatios = [];

for (const c of Object.values(cities)) {
  const audQuotes = c.quotes.map((q) => toAud(q.price, q.currency)).filter((v) => v !== null);
  const h = HEADLINE[c.city];
  const headlineAud = h?.value ? toAud(h.value, h.currency) : null;
  const truthAud = audQuotes.length ? median(audQuotes) : null;

  const entry = {
    city: c.city,
    quoteCount: audQuotes.length,
    provenance: c.provenance,
    directMedianAud: truthAud ? +truthAud.toFixed(2) : null,
    quoteSpreadFactor: audQuotes.length > 1
      ? +(Math.max(...audQuotes) / Math.min(...audQuotes)).toFixed(2) : null,
    headlineAud: headlineAud ? +headlineAud.toFixed(2) : null,
  };

  if (truthAud && headlineAud) {
    const ratio = headlineAud / truthAud;
    entry.headlineOverDirect = +ratio.toFixed(3);
    entry.headlineBiasPct = +((ratio - 1) * 100).toFixed(1);
    logRatios.push({ city: c.city, log: Math.log(ratio) });
  } else {
    entry.headlineOverDirect = null;
    entry.note = !headlineAud ? 'no headline average collected for this city'
      : 'no direct quotes obtained';
  }
  report.cities.push(entry);
}

if (logRatios.length) {
  const logs = logRatios.map((x) => x.log);
  const medLog = median(logs);
  const spread = Math.max(...logs) - Math.min(...logs);
  report.pooled = {
    citiesWithBothMeasures: logRatios.length,
    medianMultiplier: +Math.exp(medLog).toFixed(3),
    medianBiasPct: +((Math.exp(medLog) - 1) * 100).toFixed(1),
    perCityMultipliers: Object.fromEntries(logRatios.map((x) => [x.city, +Math.exp(x.log).toFixed(3)])),
    // A correction factor is only defensible if the bias is consistent. If the
    // multipliers span more than ~1.5x, correcting on the median would make
    // some cities worse than leaving the bias in place.
    multiplierSpreadFactor: +Math.exp(spread).toFixed(2),
    correctable: logRatios.length >= 3 && Math.exp(spread) <= 1.5,
    verdict: logRatios.length < 3
      ? 'insufficient cities to judge consistency; record the bias, do not correct'
      : Math.exp(spread) <= 1.5
        ? 'bias is consistent enough to publish a correction factor'
        : 'bias varies too much between cities to correct; record per-city instead',
  };
}

fs.writeFileSync(`${DIR}/accommodation-bias-report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
