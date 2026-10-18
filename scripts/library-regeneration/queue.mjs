// Lists cities without a saved answer for the v1.2 library regeneration, or summarises the answers.
//   node scripts/library-regeneration/queue.mjs <cities-dir> [--limit 6]
//   node scripts/library-regeneration/queue.mjs <cities-dir> --summary
// An answer is complete when both <id>.response.json and <id>.provenance.json exist.
import fs from 'node:fs';
import path from 'node:path';

const [dir, ...rest] = process.argv.slice(2);
const ids = fs.readdirSync(dir).filter(f => f.endsWith('.prompt.json')).map(f => f.replace(/\.prompt\.json$/, '')).sort();
const done = id => fs.existsSync(path.join(dir, `${id}.response.json`)) && fs.existsSync(path.join(dir, `${id}.provenance.json`));
if (rest.includes('--summary')) {
  const rows = ids.filter(done).map(id => {
    const text = fs.readFileSync(path.join(dir, `${id}.response.json`), 'utf8');
    let r = null;
    try { r = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch {}
    let p = {};
    try { p = JSON.parse(fs.readFileSync(path.join(dir, `${id}.provenance.json`), 'utf8')); } catch {}
    return { id, parsed: !!r, fxDate: r?.fx?.as_of_date ?? null, fxRate: r?.fx?.source_rate ?? null, search: p.web_search_used === true, urls: (p.urls ?? []).length };
  });
  const by = k => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {});
  console.log(JSON.stringify({ total: ids.length, answered: rows.length, pending: ids.length - rows.length,
    unparseable: rows.filter(r => !r.parsed).map(r => r.id), noSearch: rows.filter(r => !r.search).map(r => r.id),
    fxDates: by('fxDate'), fxRates: by('fxRate') }, null, 2));
} else {
  const limit = rest.includes('--limit') ? Number(rest[rest.indexOf('--limit') + 1]) : 6;
  for (const id of ids.filter(id => !done(id)).slice(0, limit)) console.log(id);
}
