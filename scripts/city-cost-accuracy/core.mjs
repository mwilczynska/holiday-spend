import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
export function safePath(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw Error('Unsafe output path');
  const base = fs.realpathSync(root), target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw Error('Output escaped research root');
  let cursor = path.dirname(target);
  while (cursor !== base) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Symlink output parent');
    cursor = path.dirname(cursor);
  }
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw Error('Symlink output');
  return target;
}
export function writeOnce(root, relative, value) {
  const target = safePath(root, relative);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, 'utf8') !== text) throw Error(`Immutable record differs: ${relative}`);
    return;
  }
  fs.writeFileSync(target, text, { flag: 'wx' });
}
export function checkHash(text, expected) {
  if (hash(text) !== expected) throw Error('Prompt hash mismatch');
}
export function requireConfirmationFreeze(city, frozen) {
  if (city.split === 'confirmation' && !frozen) throw Error('Confirmation is sealed until finalist freeze');
}
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export function quantile(xs, q) {
  if (!xs.length) return null;
  const ordered = [...xs].sort((a, b) => a - b), index = (ordered.length - 1) * q, low = Math.floor(index);
  return ordered[low] + (ordered[Math.ceil(index)] - ordered[low]) * (index - low);
}
// Enumerate expected run x supported reference cells, including failed runs.
export function score(cells, penaltyRatio = 4) {
  if (!(penaltyRatio > 1)) throw Error('Penalty ratio must exceed one');
  const grouped = new Map(), errors = [], biases = [];
  let failures = 0;
  for (const cell of cells) {
    if (!(Number.isFinite(cell.reference) && cell.reference > 0)) throw Error('Reference must be positive and supported');
    if (!cell.city || !cell.category || !cell.measure || !cell.run) throw Error('Missing scoring identity');
    const valid = cell.valid !== false && Number.isFinite(cell.prediction) && cell.prediction > 0;
    const log = valid ? Math.log(cell.prediction / cell.reference) : null;
    const loss = valid ? Math.abs(log) : Math.log(penaltyRatio);
    if (valid) { errors.push(Math.abs(cell.prediction / cell.reference - 1)); biases.push(log); } else failures++;
    if (!grouped.has(cell.city)) grouped.set(cell.city, new Map());
    const categories = grouped.get(cell.city);
    if (!categories.has(cell.category)) categories.set(cell.category, new Map());
    const measures = categories.get(cell.category);
    if (!measures.has(cell.measure)) measures.set(cell.measure, new Map());
    const runs = measures.get(cell.measure);
    if (runs.has(cell.run)) throw Error('Duplicate run/reference cell; aggregate offers first');
    runs.set(cell.run, loss);
  }
  const cities = Object.fromEntries([...grouped].map(([city, cats]) => [city,
    mean([...cats.values()].map(measures => mean([...measures.values()].map(runs => mean([...runs.values()])))))
  ]));
  return { primaryLoss: Object.keys(cities).length ? mean(Object.values(cities)) : null,
    cityLosses: cities, expectedCells: cells.length, failedCells: failures,
    successfulOnlyMedianAPE: quantile(errors, .5), successfulOnlyP90APE: quantile(errors, .9),
    successfulOnlyMedianLogBias: quantile(biases, .5), penaltyRatio };
}
export function pairedCityBootstrap(baseline, candidate, iterations = 10000, seed = 13102026) {
  const names = Object.keys(baseline).sort();
  if (names.length < 2 || names.join('|') !== Object.keys(candidate).sort().join('|')) throw Error('Need identical paired cities, at least two');
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const differences = names.map(name => baseline[name] - candidate[name]);
  if (!differences.every(Number.isFinite)) throw Error('Invalid paired loss');
  const samples = Array.from({ length: iterations }, () => mean(names.map(() => differences[Math.floor(random() * names.length)])));
  return { unit: 'city', cities: names.length, samples: iterations, seed,
    meanImprovement: mean(differences), lower95: quantile(samples, .025), upper95: quantile(samples, .975) };
}
