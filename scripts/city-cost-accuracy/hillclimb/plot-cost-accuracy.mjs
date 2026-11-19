// Scatter of estimated app cost per city (log scale) against the loss difference from Luna (own per-anchor
// correction) with its paired 95% interval as a vertical error bar.
//   node plot-cost-accuracy.mjs <sample-size-report.txt> <costs.json> <out.svg>
import fs from 'node:fs';

const [ownfit, costsFile, output] = process.argv.slice(2);
const families = [
  { key: 'haiku', name: 'Claude Haiku 5.5', light: '#2a78d6', dark: '#3987e5' },
  { key: 'sonnet', name: 'Claude Sonnet 5.5', light: '#eb6834', dark: '#d95926' },
  { key: 'opus', name: 'Claude Opus 5.5', light: '#1baf7a', dark: '#199e70' },
  { key: 'gpt', name: 'OpenAI GPT-6.x', light: '#eda100', dark: '#c98500' },
];
const costs = new Map(JSON.parse(fs.readFileSync(costsFile, 'utf8')).map(r => [r.lane, r.appPerCity]));
const pts = [];
let section = false;
for (const line of fs.readFileSync(ownfit, 'utf8').split(/\r?\n/)) {
  if (line.startsWith('1. ')) { section = true; continue; }
  if (line.startsWith('median') || line.startsWith('2. ')) section = false;
  const m = section && line.match(/^(\S+) \| (\d+) \| [\d.]+ \([\d.]+\) \| (-?[\d.]+) \[(-?[\d.]+), (-?[\d.]+)\]/);
  if (!m || !costs.has(m[1])) continue;
  const [, lane, n, diff, lo, hi] = m;
  const fam = lane.includes('haiku') ? 'haiku' : lane.includes('sonnet') ? 'sonnet' : lane.includes('opus') ? 'opus' : 'gpt';
  const effort = lane.split('-').at(-1) === 'exec' ? 'max' : lane.split('-').at(-1);
  const short = fam === 'gpt' ? (lane.includes('sol') ? 'Sol max' : lane.includes('terra') ? 'Terra max' : 'Luna max') : `${fam[0].toUpperCase()}${fam.slice(1)} ${effort}`;
  pts.push({ fam, short, n: +n, diff: +diff, lo: +lo, hi: +hi, cost: costs.get(lane) });
}

const W = 760, H = 560, L = 70, R = 30, T = 96, B = 92;
const cmin = 0.04, cmax = 0.6, ymin = -0.04, ymax = 0.07;
const px = c => L + (Math.log(c) - Math.log(cmin)) / (Math.log(cmax) - Math.log(cmin)) * (W - L - R);
const py = v => T + (ymax - v) / (ymax - ymin) * (H - T - B);
const f3 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
const css = `
  svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#8a8984; --grid:#e8e7e3; --zero:#52514e;
    ${families.map((f, i) => `--s${i}:${f.light};`).join(' ')} }
  @media (prefers-color-scheme: dark) { svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#8f8e86; --grid:#2e2e2c; --zero:#c3c2b7;
    ${families.map((f, i) => `--s${i}:${f.dark};`).join(' ')} } }
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; fill: var(--ink2); font-size: 12px; }
  .title { fill: var(--ink); font-size: 16px; font-weight: 600; } .lbl { fill: var(--ink); font-size: 11.5px; }
  .axis { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .pt:hover circle { r: 7; }
`;
const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`,
  `<title id="t">Estimated app cost per city against accuracy relative to GPT-6 Luna max</title>`,
  `<desc id="d">Each point is a model and effort: horizontal position is the estimated cost of one app request per city at API list prices (log scale), vertical position the loss difference from Luna with each model's own correction, with a 95% paired bootstrap interval. Lower and further left is better.</desc>`,
  `<style>${css}</style><rect width="${W}" height="${H}" fill="var(--surface)"/>`,
  `<text class="title" x="16" y="28">Cost per city against accuracy (lower left is better)</text>`,
  `<text x="16" y="48">Estimated app request cost per city at API list prices, including search fees (log scale; estimate within about 2×).</text>`,
  `<text x="16" y="66">Loss difference from Luna with each model's own correction, 95% paired interval. Claude: 80 cities; OpenAI: 20.</text>`];
for (const c of [0.05, 0.1, 0.2, 0.3, 0.5]) out.push(`<line x1="${px(c)}" x2="${px(c)}" y1="${T}" y2="${H - B}" stroke="var(--grid)"/><text class="axis" x="${px(c)}" y="${H - B + 16}" text-anchor="middle">$${c.toFixed(2)}</text>`);
for (const v of [-0.04, -0.02, 0, 0.02, 0.04, 0.06]) out.push(`<line x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}" stroke="var(--${v === 0 ? 'zero' : 'grid'})"${v === 0 ? ' stroke-width="1.5" stroke-dasharray="4 3"' : ''}/><text class="axis" x="${L - 8}" y="${py(v) + 4}" text-anchor="end">${v === 0 ? '0' : f3(v)}</text>`);
out.push(`<text class="axis" x="${L + 6}" y="${py(0) + 16}">Luna's accuracy</text>`);
out.push(`<text class="axis" x="${(L + W - R) / 2}" y="${H - B + 36}" text-anchor="middle">Estimated app cost per city (USD, log scale)</text>`);
out.push(`<text class="axis" transform="translate(18 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Loss vs Luna (positive = less accurate)</text>`);
// Label offsets chosen to avoid collisions among nearby points.
const nudge = { 'Opus low': [10, 14], 'Opus medium': [10, 16], 'Opus high': [10, 4], 'Sonnet low': [6, -10], 'Sonnet medium': [10, 4], 'Sonnet high': [10, -6], 'Haiku medium': [-10, -6, 'end'], 'Haiku high': [10, 4], 'Haiku low': [-10, 4, 'end'], 'Luna max': [-10, -8, 'end'], 'Terra max': [10, 14] };
for (const p of pts) {
  const i = families.findIndex(f => f.key === p.fam), x = px(p.cost), [dx, dy, anchor] = nudge[p.short] ?? [10, 4];
  out.push(`<g class="pt"><title>${p.short} (${p.n} cities): about $${p.cost.toFixed(3)} per city; ${f3(p.diff)} vs Luna [${f3(p.lo)}, ${f3(p.hi)}]</title>`,
    `<line x1="${x}" x2="${x}" y1="${py(p.lo)}" y2="${py(p.hi)}" stroke="var(--s${i})" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`,
    ...[p.lo, p.hi].map(e => `<line x1="${x - 4}" x2="${x + 4}" y1="${py(e)}" y2="${py(e)}" stroke="var(--s${i})" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`),
    `<circle cx="${x}" cy="${py(p.diff)}" r="5" fill="var(--s${i})" stroke="var(--surface)" stroke-width="2"/>`,
    `<text class="lbl" x="${x + dx}" y="${py(p.diff) + dy}"${anchor ? ` text-anchor="${anchor}"` : ''}>${p.short}</text></g>`);
}
let lx = 16; const ly = H - 18;
for (const [i, f] of families.entries()) { out.push(`<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="var(--s${i})"/><text x="${lx + 15}" y="${ly}">${f.name}</text>`); lx += 30 + f.name.length * 6.6; }
out.push('</svg>');
fs.writeFileSync(output, out.join('\n') + '\n');
console.log(`${pts.length} points -> ${output}`);
