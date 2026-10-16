// Converts in-browser booking-platform captures into panel rows (R3 accommodation).
//   node ingest-platforms.mjs booking <results.json> <out-name>
//   node ingest-platforms.mjs trip <results.json> <out-name>
// Searches: 2 adults, 1 room, 9-11 March 2027 (Tue-Thu, 2 nights), USD, owner's logged-in sessions, so displayed
// prices are member prices; per-night values include taxes and fees.
//  booking: first results page (up to 25 cards) per query, server-rendered, default "top picks" order.
//           3star = class=3 hotels/guest houses/B&Bs -> hotel_3star_2p (median).
//           decent = review score 7+ hotels/guest houses/B&Bs, any class -> hotel_1star_2p (25th percentile,
//           a price-tier definition of "very basic registered hotel or guesthouse").
//  trip:    list API replayed in-page, up to 3 pages of 3-star; hotels/guest houses/inns/B&Bs/homestays with rooms
//           for 2 adults (or unstated) -> hotel_3star_2p (median of paid price = total incl. tax / nights).
//           1-2 star medians are kept as diagnostics (star ratings do not order central-city prices).
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, splitOf } from './lib.mjs';

const [platform, file, outName] = process.argv.slice(2);
const panel = new Map(loadPanel().map(r => [r.cityKey, r]));
const grade = n => n >= 15 ? 'B' : n >= 6 ? 'C' : null;
const rows = [];
for (const x of readJson(file)) {
  const c = panel.get(x.key);
  if (!c || x.error) continue;
  const base = { cityKey: x.key, city: c.city, country: c.country, region: c.region, split: splitOf(x.key), observedAt: x.capturedAt?.slice(0, 10),
    capturedAt: x.capturedAt, contributors: null, localValue: null, currency: 'USD', fx: null, stay: '2027-03-09/2027-03-11, 2 adults, 1 room' };
  const push = (anchor, value, n, family, source, notes, extra = {}) => {
    const g = grade(n);
    if (!(value > 0) || !g) return;
    rows.push({ ...base, anchor, valueUsd: value, sampleSize: n, grade: g, source, sourceFamily: family, notes, ...extra });
  };
  if (platform === 'booking') {
    const k3 = x.classes?.['3star'], kd = x.classes?.decent, k12 = x.classes?.['1-2star'];
    const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(x.ss)}`;
    if (k3?.status === 200) push('hotel_3star_2p', k3.median, k3.kept, 'booking-platform-search', 'booking', `Median per-night price incl. taxes of ${k3.kept} first-page 3-star hotels/guest houses/B&Bs (of ${k3.found} found).`, { sourceUrl: url, p25: k3.p25, p75: k3.p75 });
    if (kd?.status === 200) push('hotel_1star_2p', kd.p25, kd.kept, 'booking-platform-search', 'booking', `25th percentile per-night price incl. taxes of ${kd.kept} first-page hotels/guest houses/B&Bs rated 7+ (any class; ${kd.found} found). Price-tier definition of a basic room.`, { sourceUrl: url, median: kd.median, p10: kd.p10, oneTwoStarMedian: k12?.median ?? null });
  } else if (platform === 'trip') {
    const t3 = x.classes?.['3star'], t12 = x.classes?.['1-2star'];
    const url = `https://www.trip.com/hotels/list?cityId=${x.tripCityId}`;
    if (t3 && !t3.err) push('hotel_3star_2p', t3.paidMedian, t3.kept, 'trip-platform-search', 'trip.com', `Median paid per-night price incl. taxes of ${t3.kept} 3-star properties (list API, up to 3 pages; pre-discount list median ${t3.listMedian}).`, { sourceUrl: url, tripCityId: x.tripCityId, tripSub: x.tripSub, listMedian: t3.listMedian, oneTwoStarPaidMedian: t12?.paidMedian ?? null });
  } else throw Error('platform must be booking or trip');
}
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
fs.copyFileSync(file, path.join(hcRoot, `panel/${outName}.raw.json`));
console.log(`${rows.length} rows for ${new Set(rows.map(r => r.cityKey)).size} cities`);
