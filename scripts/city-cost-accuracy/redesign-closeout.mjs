import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,safePath,writeOnce} from './core.mjs';
import {run,journalPrefix} from './redesign.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'research/city-cost-accuracy/redesign-1');
const summary=run(['summary']);
const assessment=JSON.parse(fs.readFileSync(path.join(root,'designer-assessment.json')));
const budgetBytes=fs.readFileSync(path.join(root,'budget.jsonl')),current=journalPrefix(budgetBytes);
if(current.state.started.length)throw Error('Unfinished calls remain');
if(assessment.verdict.decision!==summary.verdict||assessment.contractSha256!==summary.contractSha256)throw Error('Assessment/result mismatch');
const verified=assessment.evidenceFiles.map(entry=>{
  let bytes=fs.readFileSync(safePath(repo,entry.path));
  if(entry.prefixEvents)bytes=journalPrefix(bytes,entry.prefixEvents).bytes;
  if(hash(bytes)!==entry.sha256)throw Error(`Assessment evidence changed: ${entry.path}`);
  return entry;
});
const names=['REPORT.md','designer-assessment.json','designer-assessment.md','contract.json','freeze.json','execution-summary.json','budget.jsonl'];
const artifacts=Object.fromEntries(names.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
const outcome={schemaVersion:1,status:'experiment_complete_inconclusive',verdict:summary.verdict,contractSha256:summary.contractSha256,
  finalJournalSequence:current.events.length,consumed:current.state.used,unexecutedReservations:current.state.reserved,activeCalls:current.state.started,
  expected:summary.expected,observed:summary.observed,precisionMeasured:false,newEstimates:0,candidatesExecuted:0,confirmationExecuted:false,
  engineering:{tasks:3,turns:4},assessmentEvidenceVerified:verified,artifacts,
  scope:'One separately authorized measurement experiment; no new goal or automatic further experiment. Listed-price feasibility/precision only; no app/city-population accuracy claim.',
  reservationDisposition:'Prior protected allocations remain unexecuted historical reservations, not dispatch authorization. Cumulative consumed counters never reset.',
  telemetry:'24 new charged reference actions:6 traceable worker-reported plus18 conservative caps. Raw arrays report17; native browsing not independently captured. Old estimate unknown8 is an accounting convention, not a proven bound.'};
writeOnce(root,'closeout.json',outcome);
console.log(JSON.stringify({status:outcome.status,verdict:outcome.verdict,observed:outcome.observed,activeCalls:outcome.activeCalls,consumed:outcome.consumed,verifiedAssessmentFiles:verified.length},null,2));
