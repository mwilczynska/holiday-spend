import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {hash,writeOnce} from './core.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(fs.realpathSync(repo).toLowerCase()!=='c:\\users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend')throw Error('Wrong worktree');
const root=path.join(repo,'research/city-cost-accuracy');
const originalBytes=fs.readFileSync(path.join(root,'redesign-1/design.json'));
const patchBytes=fs.readFileSync(path.join(root,'redesign-1/design-repair.json'));
const original=JSON.parse(originalBytes),patch=JSON.parse(patchBytes),merged=structuredClone(original);
assert.equal(hash(originalBytes),patch.originalDesignSha256);
for(const operation of patch.operations){
  assert(['add','replace'].includes(operation.op));
  assert(operation.path.startsWith('/'));
  const segments=operation.path.slice(1).split('/').map(s=>s.replaceAll('~1','/').replaceAll('~0','~'));
  assert(segments.every(s=>!['__proto__','prototype','constructor'].includes(s)));
  let parent=merged;
  for(const key of segments.slice(0,-1)){assert(Object.hasOwn(parent,key));parent=parent[key];}
  const key=segments.at(-1);
  assert.equal(Object.hasOwn(parent,key),operation.op==='replace');
  parent[key]=structuredClone(operation.value);
}
for(const key of ['cities','definition','selection','estimand','worker','schedule','calculations','decision','budget'])assert.deepEqual(merged[key],original[key],`Scientific criteria changed: ${key}`);
assert.equal(merged.hypothesis.practicalMargin,original.hypothesis.practicalMargin);
assert.equal(merged.hypothesis.statement,original.hypothesis.statement);
merged.status='coordinator_validated';
const acceptedFile=path.join(root,'redesign-1/contract-input.json');
const validatedAt=fs.existsSync(acceptedFile)?JSON.parse(fs.readFileSync(acceptedFile)).coordinatorValidation.validatedAt:new Date().toISOString();
merged.coordinatorValidation={validated:true,validatedBy:'/root',validatedAt,
  originalDesignSha256:hash(originalBytes),repairSha256:hash(patchBytes),
  note:'Mechanical application of the one Astra-authored pre-data repair; original scientific thresholds, cities, queries, task schedule and budgets unchanged. Execution implementation/test/freeze gate must pass before any cost dispatch.'};
writeOnce(root,'redesign-1/contract-input.json',merged);
console.log(JSON.stringify({status:merged.status,originalSha256:hash(originalBytes),repairSha256:hash(patchBytes),tasks:merged.schedule.length,maxActions:merged.schedule.reduce((n,t)=>n+t.maxActions,0)},null,2));
