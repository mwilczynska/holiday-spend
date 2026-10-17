import { loadPanel, sha256, mean } from '../../../../../scripts/city-cost-accuracy/hillclimb/lib.mjs';
// Accommodation booking prices (R3) for four other dev cities: same country first, then same region, in a
// deterministic hash order. Leave-one-out; test cities never appear. Food and drink come from the prompt's searches.
const LABELS = { hotel_3star_2p: 'three-star hotel room for two', hotel_1star_2p: 'basic hotel or guesthouse room for two',
  hostel_dorm_1p: 'hostel dorm bed', hostel_private_2p: 'private hostel room for two' };
export default city => {
  const byCity = new Map();
  for (const r of loadPanel()) {
    if (r.split !== 'dev' || r.cityKey === city.cityKey || !LABELS[r.anchor]) continue;
    if (!byCity.has(r.cityKey)) byCity.set(r.cityKey, { city: r.city, country: r.country, region: r.region, logs: {} });
    (byCity.get(r.cityKey).logs[r.anchor] ??= []).push(Math.log(r.valueUsd));
  }
  const rank = c => (c.country === city.country ? 0 : c.region === city.region ? 1 : 2);
  const picked = [...byCity.entries()].filter(([, c]) => c.logs.hotel_3star_2p)
    .sort((a, b) => rank(a[1]) - rank(b[1]) || sha256(`${city.cityKey}|${a[0]}`).localeCompare(sha256(`${city.cityKey}|${b[0]}`)))
    .slice(0, 4);
  const lines = picked.map(([, c]) => `- ${c.city}, ${c.country}: ` + Object.keys(LABELS).filter(a => c.logs[a])
    .map(a => `${LABELS[a]} $${Math.exp(mean(c.logs[a])).toFixed(0)}`).join('; '));
  return `Typical accommodation booking prices in comparable cities (USD per night, year-typical, taxes included). The requested city may be cheaper or more expensive than these.\n${lines.join('\n')}`;
};
