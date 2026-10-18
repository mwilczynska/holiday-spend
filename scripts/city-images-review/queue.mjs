// Lists photo review tasks without a verdict (for Codex workers), or summarises verdicts.
//   node scripts/city-images-review/queue.mjs <review-dir> [--limit 6]
//   node scripts/city-images-review/queue.mjs <review-dir> --summary
import fs from 'node:fs';
import path from 'node:path';

const [dir, ...rest] = process.argv.slice(2);
const { tasks } = JSON.parse(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8'));
const verdictFile = id => path.join(dir, 'tasks', id, 'verdict.json');
if (rest.includes('--summary')) {
  const counts = {}, flagged = [];
  for (const t of tasks) {
    if (!fs.existsSync(verdictFile(t.id))) { counts.pending = (counts.pending ?? 0) + 1; continue; }
    let v;
    try { v = JSON.parse(fs.readFileSync(verdictFile(t.id), 'utf8')); } catch { v = { verdict: 'unparseable' }; }
    counts[v.verdict] = (counts[v.verdict] ?? 0) + 1;
    if (v.verdict !== 'ok') flagged.push({ id: t.id, city: t.city, country: t.country, verdict: v.verdict, reason: v.reason ?? null, commonsFile: t.commonsFile });
  }
  console.log(JSON.stringify({ counts, flagged }, null, 2));
} else {
  const limit = rest.includes('--limit') ? Number(rest[rest.indexOf('--limit') + 1]) : 6;
  for (const t of tasks.filter(t => !fs.existsSync(verdictFile(t.id))).slice(0, limit)) console.log(t.id);
}
