// Builds comparable-city context from the reference panel for the {{EXTRA_CONTEXT}} slot.
// Leave-one-out and dev-only: the target city and every test city are excluded. Comparables are chosen by
// same country first, then same region, in a deterministic hash order, up to `count` cities.
import { loadPanel, sha256, mean } from './lib.mjs';

const LABELS = { beer: 'draught beer 0.5 L', coffee: 'cappuccino', inexp_meal_1p: 'inexpensive-restaurant meal',
  midrange_meal_2p: 'mid-range three-course meal for two', hostel_dorm_1p: 'hostel dorm bed',
  hostel_private_2p: 'private hostel room for two', hotel_1star_2p: 'basic hotel room for two',
  hotel_3star_2p: 'three-star hotel room for two' };

export function comparableContext(city, { count = 3, header } = {}) {
  const rows = loadPanel().filter(r => r.split === 'dev' && r.cityKey !== city.cityKey);
  const byCity = new Map();
  for (const r of rows) {
    if (!byCity.has(r.cityKey)) byCity.set(r.cityKey, { city: r.city, country: r.country, region: r.region, logs: {} });
    (byCity.get(r.cityKey).logs[r.anchor] ??= []).push(Math.log(r.valueUsd));
  }
  const rank = c => (c.country === city.country ? 0 : c.region === city.region ? 1 : 2);
  const picked = [...byCity.entries()]
    .sort((a, b) => rank(a[1]) - rank(b[1]) || sha256(`${city.cityKey}|${a[0]}`).localeCompare(sha256(`${city.cityKey}|${b[0]}`)))
    .slice(0, count);
  const lines = picked.map(([, c]) => `- ${c.city}, ${c.country}: ` + Object.keys(LABELS).filter(a => c.logs[a])
    .map(a => `${LABELS[a]} $${Math.exp(mean(c.logs[a])).toFixed(2)}`).join('; '));
  return `${header ?? 'Observed typical prices in comparable cities (USD, mid-2026), for calibrating price levels. The requested city may be cheaper or more expensive than these.'}\n${lines.join('\n')}`;
}
