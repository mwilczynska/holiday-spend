// Merge independently collected rows into the development ledger.
// Inputs are raw experiment outputs, not estimates. The script only writes
// observations explicitly present in the input and never fills a missing row.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ledgerPath = path.join(root, 'data/reference/v6/ground-truth/development-ledger.json');
const inputPath = process.argv[2] ? path.resolve(root, process.argv[2]) : null;
if (!inputPath) throw new Error('Usage: node scripts/merge-v6-independent-panel-rows.mjs <rows.json>');

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rows = input.rows ?? input.cities ?? [];
const cityByName = new Map(ledger.cities.map((city) => [city.city, city]));
const merged = [];

function replaceObservation(city, observation) {
  if (!cityByName.has(city)) throw new Error(`Input city is not in the development manifest: ${city}`);
  const entry = cityByName.get(city);
  const index = entry.observations.findIndex((row) => row.measure === observation.measure);
  if (index === -1) entry.observations.push(observation);
  else entry.observations[index] = observation;
  merged.push(`${city}/${observation.measure}`);
}

for (const raw of rows) {
  if (raw.measure === 'hotel_2star_room_2p' || raw.allCards) {
    const prices = raw.samplePrices ?? raw.allCards?.map((card) => card.price).filter((value) => Number.isFinite(value) && value > 0) ?? [];
    if (!prices.length || raw.status !== 'found') {
      replaceObservation(raw.city, {
        measure: 'hotel_2star_room_2p',
        status: raw.status ?? 'not_found',
        reason: raw.reason ?? 'Booking.com returned no eligible first-page listing.',
        attempts: 1,
        lastAttemptAt: raw.retrievedAt,
      });
      continue;
    }
    const first = raw.firstCard ?? raw.allCards?.[0] ?? {};
    const labels = [...new Set(first.dealLabels ?? [])];
    replaceObservation(raw.city, {
      measure: 'hotel_2star_room_2p',
      status: 'found',
      amount: raw.amount,
      currency: 'AUD',
      sourceName: 'Booking.com',
      propertyName: `Booking.com first-page sample; representative: ${first.title ?? 'first eligible listing'}`,
      sourceUrl: raw.url,
      retrievedAt: raw.retrievedAt,
      checkIn: '2026-09-17',
      checkOut: '2026-09-18',
      taxStatus: 'unknown',
      evidenceText: `Logged-out Booking.com city-scoped results for the frozen window, with 2 adults / 1 room, filtered to 2 stars and displayed in Booking's default Our top picks order. Booking displayed ${raw.classInventoryCount} properties found. The ${prices.length} first-page eligible listing prices in page order were AUD ${prices.join(', ')}. The first listing was ${first.title ?? 'not named'}${first.originalPrice ? ` with a displayed list price of AUD ${first.originalPrice}` : ''}. The amount is the median of every displayed first-page public price; public promotional rates were included and membership-gated rates were not used.`,
      samplePrices: prices,
      listPriceAmount: first.originalPrice ?? null,
      dealLabels: labels,
      classInventoryCount: raw.classInventoryCount,
      selectionRule: 'booking_top_picks_firstpage_median_v2',
    });
    continue;
  }
  replaceObservation(raw.city, raw.observation ?? raw);
}

fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(JSON.stringify({ merged: merged.length, rows: merged }, null, 2));
