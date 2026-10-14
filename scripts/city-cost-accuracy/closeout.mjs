import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,writeOnce} from './core.mjs';
import {run} from './restart.mjs';
import {budgetPrefix} from './audit-final.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'research/city-cost-accuracy'), target='restart-1-prep';
const bytes=relative=>fs.readFileSync(path.join(repo,relative));
const read=relative=>JSON.parse(bytes(relative));
run(['verify',target]);
const assessment=read(`research/city-cost-accuracy/${target}/designer-assessment.json`);
const state=run(['budget',target]);
if(state.started.length)throw Error('Unfinished calls remain');
const evidence=[];
for(const entry of assessment.evidenceFiles){
  let data=bytes(entry.path),prefixEventCount=null;
  if(entry.path.endsWith('/budget.jsonl')){
    prefixEventCount=assessment.resources.asOfBudgetSequence;
    data=budgetPrefix(data,prefixEventCount).bytes;
  }
  if(hash(data)!==entry.sha256)throw Error(`Assessment input changed: ${entry.path}`);
  evidence.push({...entry,prefixEventCount});
}
const files=['REPORT-RESTART-1.md','restart-leaderboard.csv',`${target}/designer-assessment.json`,`${target}/designer-assessment.md`,`${target}/budget.jsonl`,`${target}/execution-summary.json`];
const artifacts=Object.fromEntries(files.map(relative=>[relative,hash(fs.readFileSync(path.join(root,relative)))]));
const lines=fs.readFileSync(path.join(root,'restart-leaderboard.csv'),'utf8').trim().split(/\r?\n/);
if(lines.some(line=>line.split(',').length!==12))throw Error('Malformed result ledger');
const outcome={schemaVersion:1,status:'scientific_run_closed',verdict:assessment.verdict,contractSha256:assessment.contractSha256,
  finalJournalSequence:fs.readFileSync(path.join(root,target,'budget.jsonl'),'utf8').trim().split('\n').length,
  currentCumulativeUsage:state.used,unexecutedProtectedReservations:state.reserved,activeCalls:state.started,
  reservationDisposition:'Preserved historical future allocations; never executed, not new dispatch authorization. No consumed counters reset.',
  assessmentEvidenceVerified:evidence,artifacts,
  modelScope:'Cost data: Codex gpt-6-luna/max; design/assessment: gpt-6-astra/medium. Haiku/Opus unverified.',
  engineeringDelegations:2,candidatesExecuted:0,confirmationExecuted:false,tenExperimentReviewDue:false,
  reason:'Designer-assessed frozen feasibility failed. Closeout contains actual acquisition/review evidence and prior measured baseline; no comparative improvement claim.',
  immutableSourceChecks:'restart verify; audit-final --replay additionally verifies the original execution snapshot and current lawful journal replay.'};
writeOnce(root,`${target}/closeout.json`,outcome);
console.log(JSON.stringify({status:outcome.status,verdict:outcome.verdict,finalJournalSequence:outcome.finalJournalSequence,activeCalls:state.started,usage:state.used},null,2));
