import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,writeOnce} from './core.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(fs.realpathSync(repo).toLowerCase()!=='c:\\users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend') throw Error('Wrong worktree');
const root=path.join(repo,'research/city-cost-accuracy');
const hashes={};
const read=relative=>{
  const raw=fs.readFileSync(path.join(root,relative));
  hashes[relative]=hash(raw);
  return JSON.parse(raw);
};
const lines=relative=>{
  const raw=fs.readFileSync(path.join(root,relative),'utf8');
  hashes[relative]=hash(raw);
  return raw.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
};
const manifest=read('manifest.json');
const prior=lines('estimation-dispatches.jsonl'),recoveries=lines('artifact-recovery-dispatches.jsonl');
const known={search:0,open:0},unknown=[];
const kindMap={search:'search',web_search:'search',open:'open',page_read:'open',retrieval:'open',retrieve:'open'};
for(const call of prior){
  const p=read(`experiments/000-baseline/runs/${call.runId}/provenance.json`);
  const counted={search:0,open:0};
  for(const action of p.actions){
    const kind=kindMap[action.kind];
    if(!kind) throw Error(`Unmapped prior action ${action.kind}`);
    counted[kind]++;known[kind]++;
  }
  if(p.searchCount===null||p.retrievalCount===null) unknown.push(call.runId);
  else if(counted.search!==p.searchCount||counted.open!==p.retrievalCount) throw Error(`Telemetry disagreement: ${call.runId}`);
}
const references=manifest.cities.filter(city=>city.pilot).map(city=>read(`references/${city.id}.json`));
const reviewFiles=fs.readdirSync(path.join(root,'references')).filter(name=>name.startsWith('review-')).sort();
const reviews=reviewFiles.map(name=>read(`references/${name}`));
const fx=read('fx-freeze.json');
const audit={phase:'designer-led-restart',priorProtocol:'pilot-1',priorBaseline:'000-baseline',
  estimateCalls:prior.length+recoveries.reduce((sum,entry)=>sum+entry.calls,0),predictionAttempts:prior.length,
  referenceCalls:3,referenceActions:references.reduce((sum,item)=>sum+item.actions.length,0)+reviews.reduce((sum,item)=>sum+item.actions.length,0)+fx.actions.length,
  estimateActionsKnown:known.search+known.open,estimateSearchesKnown:known.search,estimateOpensKnown:known.open,
  unknownEstimateActionRuns:unknown,
  designCallsAtRestart:2,
  designCallNote:'One completed architecture draft plus one reserved/dispatched restart design. Later design calls belong in the new budget journal.',
  referenceCallNote:'Three original reference-worker dispatches; original independent review and normalization were coordinator tool actions, not worker invocations.',
  exposure:{releasedDevelopmentCities:manifest.cities.filter(city=>city.pilot).map(city=>city.id),
    confirmation:'Names preregistered; no confirmation price evidence collected/revealed. Old v5/v6 holdouts closed.',
    compatibility:'Prior outputs/evidence are exposed. New definitions or evidence rules create a separate labelled stratum.'},
  unknownPolicy:'Unknown is not zero. New protocol must specify a conservative accounting reservation; do not claim it is observed usage or a proven upper bound.',
  paidProviderApiCalls:0,hashes};
writeOnce(root,'restart-prior-audit.json',audit);
console.log(JSON.stringify({...audit,hashes:undefined},null,2));
