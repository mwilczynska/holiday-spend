// Dot plot of each model/effort's loss difference from Luna (own per-anchor correction, leave-one-city-out) with
// paired-bootstrap 95% intervals, read from section 1 of a sample-size.mjs report.
//   node plot-models.mjs <sample-size-report.txt> <out.svg>
// Rows are grouped by model family; colour marks the family and every row is also labelled, so identity never
// depends on colour. Light and dark themes follow prefers-color-scheme. Hovering a row shows its values.
import fs from 'node:fs';

const [input, output] = process.argv.slice(2);
const families = [
  { key: 'haiku', name: 'Claude Haiku 5.5', light: '#2a78d6', dark: '#3987e5' },
  { key: 'sonnet', name: 'Claude Sonnet 5.5', light: '#eb6834', dark: '#d95926' },
  { key: 'opus', name: 'Claude Opus 5.5', light: '#1baf7a', dark: '#199e70' },
  { key: 'gpt', name: 'OpenAI GPT-6.x', light: '#eda100', dark: '#c98500' },
];
const effortOrder = ['low', 'medium', 'high', 'xhigh', 'max'];
const rows = [];
let section = false;
for (const line of fs.readFileSync(input, 'utf8').split(/\r?\n/)) {
  if (line.startsWith('1. ')) { section = true; continue; }
  if (line.startsWith('median') || line.startsWith('2. ')) section = false;
  const m = section && line.match(/^(\S+) \| (\d+) \| ([\d.]+) \(([\d.]+)\) \| (-?[\d.]+) \[(-?[\d.]+), (-?[\d.]+)\]/);
  if (!m) continue;
  const [, lane, n, loss, luna, diff, lo, hi] = m;
  const fam = lane.includes('haiku') ? 'haiku' : lane.includes('sonnet') ? 'sonnet' : lane.includes('opus') ? 'opus' : 'gpt';
  const effort = effortOrder.find(e => lane.endsWith(`-${e}`) || lane.includes(`-${e}-`)) ?? 'max';
  const label = fam === 'gpt' ? `${lane.includes('sol') ? 'GPT-6.2 Sol' : lane.includes('terra') ? 'GPT-6.1 Terra' : 'GPT-6 Luna rerun'} max` : `${fam[0].toUpperCase()}${fam.slice(1)} ${effort}`;
  rows.push({ fam, effort, label, n: +n, loss: +loss, luna: +luna, diff: +diff, lo: +lo, hi: +hi });
}
rows.sort((a, b) => families.findIndex(f => f.key === a.fam) - families.findIndex(f => f.key === b.fam) || effortOrder.indexOf(a.effort) - effortOrder.indexOf(b.effort) || a.label.localeCompare(b.label));

const W = 760, left = 190, right = 90, top = 96, rowH = 26, groupGap = 14;
let y = top; const placed = [];
rows.forEach((r, i) => { if (i && r.fam !== rows[i - 1].fam) y += groupGap; placed.push({ ...r, y }); y += rowH; });
const plotBottom = y + 4, H = plotBottom + 78;
const xmin = -0.06, xmax = 0.08, px = v => left + (v - xmin) / (xmax - xmin) * (W - left - right);
const ticks = [-0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06, 0.08];
const f3 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);

const css = `
  svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#8a8984; --grid:#e8e7e3; --zero:#52514e;
    ${families.map((f, i) => `--s${i}:${f.light};`).join(' ')} }
  @media (prefers-color-scheme: dark) { svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#8f8e86; --grid:#2e2e2c; --zero:#c3c2b7;
    ${families.map((f, i) => `--s${i}:${f.dark};`).join(' ')} } }
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; fill: var(--ink2); font-size: 12px; }
  .title { fill: var(--ink); font-size: 16px; font-weight: 600; } .sub { font-size: 12px; } .lbl { fill: var(--ink); font-size: 12.5px; }
  .val { font-variant-numeric: tabular-nums; } .axis { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .row:hover .hit { fill: var(--grid); }
`;
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`);
out.push(`<title id="t">City-cost accuracy by model and effort, relative to GPT-6 Luna max</title>`);
out.push(`<desc id="d">For each model and effort, the difference in budget-weighted loss from GPT-6 Luna max on the same cities, each model with its own per-anchor correction, with 95% paired bootstrap intervals. Positive is less accurate than Luna.</desc>`);
out.push(`<style>${css}</style><rect width="${W}" height="${H}" fill="var(--surface)"/>`);
out.push(`<text class="title" x="16" y="28">Accuracy against GPT-6 Luna max, each model with its own correction</text>`);
out.push(`<text class="sub" x="16" y="48">Loss difference from Luna on the same cities (budget-weighted mean |ln(estimate/reference)|), 95% paired bootstrap interval.</text>`);
out.push(`<text class="sub" x="16" y="66">Claude models: 80 dev cities. OpenAI models: 20 of those cities, so their intervals are wider.</text>`);
for (const t of ticks) {
  out.push(`<line x1="${px(t)}" x2="${px(t)}" y1="${top - 8}" y2="${plotBottom}" stroke="var(--${t === 0 ? 'zero' : 'grid'})" stroke-width="${t === 0 ? 1.5 : 1}"${t === 0 ? ' stroke-dasharray="4 3"' : ''}/>`);
  out.push(`<text class="axis" x="${px(t)}" y="${plotBottom + 16}" text-anchor="middle">${t === 0 ? '0' : f3(t)}</text>`);
}
out.push(`<text class="axis" x="${px(0)}" y="${top - 14}" text-anchor="middle">Luna</text>`);
out.push(`<text class="axis" x="${px(xmin)}" y="${plotBottom + 34}">← more accurate than Luna</text>`);
out.push(`<text class="axis" x="${px(xmax)}" y="${plotBottom + 34}" text-anchor="end">less accurate than Luna →</text>`);
for (const r of placed) {
  const i = families.findIndex(f => f.key === r.fam), cy = r.y + rowH / 2;
  out.push(`<g class="row"><title>${r.label} (${r.n} cities): loss ${r.loss.toFixed(3)} vs Luna ${r.luna.toFixed(3)}; difference ${f3(r.diff)} [${f3(r.lo)}, ${f3(r.hi)}]</title>`);
  out.push(`<rect class="hit" x="8" y="${r.y + 1}" width="${W - 16}" height="${rowH - 2}" rx="4" fill="transparent"/>`);
  out.push(`<text class="lbl" x="${left - 14}" y="${cy + 4}" text-anchor="end">${r.label}${r.n < 80 ? ` (${r.n})` : ''}</text>`);
  out.push(`<line x1="${px(r.lo)}" x2="${px(r.hi)}" y1="${cy}" y2="${cy}" stroke="var(--s${i})" stroke-width="2" stroke-linecap="round"/>`);
  for (const e of [r.lo, r.hi]) out.push(`<line x1="${px(e)}" x2="${px(e)}" y1="${cy - 5}" y2="${cy + 5}" stroke="var(--s${i})" stroke-width="2" stroke-linecap="round"/>`);
  out.push(`<circle cx="${px(r.diff)}" cy="${cy}" r="5" fill="var(--s${i})" stroke="var(--surface)" stroke-width="2"/>`);
  out.push(`<text class="val" x="${W - right + 12}" y="${cy + 4}">${f3(r.diff)}</text>`);
  out.push(`</g>`);
}
let lx = 16; const ly = H - 18;
for (const [i, f] of families.entries()) {
  out.push(`<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="var(--s${i})"/><text x="${lx + 15}" y="${ly}">${f.name}</text>`);
  lx += 30 + f.name.length * 6.6;
}
out.push(`</svg>`);
fs.writeFileSync(output, out.join('\n') + '\n');
console.log(`${rows.length} rows -> ${output}`);
