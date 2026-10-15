// Creates a candidate iteration from a base template plus exact string replacements, failing if any replacement
// does not match exactly once. Keeps every candidate a reviewable minimal diff of its parent prompt.
//   node make-candidate.mjs <spec.json>
// spec: { id, parent, family, hypothesis, baseTemplate, replacements: [[from, to], ...], repeats, ...candidate fields }
// baseTemplate is either a docs/ path (production) or an hillclimb-relative path such as iterations/002-x/prompt.md.
import fs from 'node:fs';
import path from 'node:path';
import { repo, hcRoot, readJson } from './lib.mjs';

const spec = readJson(process.argv[2]);
const dir = path.join(hcRoot, 'iterations', spec.id);
if (fs.existsSync(path.join(dir, 'freeze.json'))) throw Error(`${spec.id} is already frozen`);
const basePath = spec.baseTemplate.startsWith('docs/') ? path.join(repo, spec.baseTemplate) : path.join(hcRoot, spec.baseTemplate);
let prompt = fs.readFileSync(basePath, 'utf8');
// Multi-line replacements adopt the template's line ending (the Windows checkout of the production template is CRLF).
const eol = prompt.includes('\r\n') ? '\r\n' : '\n';
for (const [rawFrom, rawTo] of spec.replacements ?? []) {
  const from = rawFrom.replace(/\r?\n/g, eol), to = rawTo.replace(/\r?\n/g, eol);
  const count = prompt.split(from).length - 1;
  if (count !== 1) throw Error(`Replacement matched ${count} times: ${from.slice(0, 80)}`);
  prompt = prompt.replace(from, () => to);
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'prompt.md'), prompt);
const { replacements, baseTemplate, ...rest } = spec;
const candidate = { split: 'dev', referenceDate: 'July 2026', extraContext: null, transform: null,
  lane: 'claude-haiku-5-5/max (claude -p, app system prompt, WebSearch only)', cliModel: 'claude-haiku-5-5', effort: 'max',
  ...rest, promptTemplate: 'prompt.md', derivedFrom: baseTemplate, replacements: replacements ?? [] };
fs.writeFileSync(path.join(dir, 'candidate.json'), JSON.stringify(candidate, null, 2) + '\n');
console.log(`Created ${spec.id} (${(replacements ?? []).length} replacements).`);
