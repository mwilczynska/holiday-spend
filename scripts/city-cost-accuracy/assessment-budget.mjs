import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {appendBudget} from './budget.mjs';
import {run,budgetPlan} from './restart.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../research/city-cost-accuracy');
const target='restart-1-prep', relative=`${target}/budget.jsonl`, id='assessment-restart-1';
run(['verify',target]);
const design=JSON.parse(fs.readFileSync(path.join(root,target,'contract.json'),'utf8'));
const limits=budgetPlan(design).limits;
const events=()=>fs.readFileSync(path.join(root,relative),'utf8').trim().split('\n').map(JSON.parse);
const append=e=>appendBudget(root,relative,limits,e);
const command=process.argv[2];
if(command==='start'){
  if(events().some(e=>e.id===id))throw Error('Assessment already registered');
  if(run(['budget',target]).started.length)throw Error('Finish reference workers first');
  // Split, do not reset or consume the protected future assessment reserve.
  append({type:'cancel',id:'protected-design-assessments',note:'Split five-call reservation for one actual assessment and four protected future calls.'});
  append({type:'reserve',id,resources:{designInvocations:1}});
  append({type:'reserve',id:'protected-future-assessments',resources:{designInvocations:4}});
  append({type:'start',id,consumed:{designInvocations:1},model:'gpt-6-astra',effort:'medium',runtime:'Codex subagent'});
  const ledger=path.join(root,'design-dispatches.jsonl'),n=fs.readFileSync(ledger,'utf8').trim().split('\n').length;
  fs.appendFileSync(ledger,JSON.stringify({sequence:n+1,phase:'designer-led-restart',role:'post_feasibility_assessment',task:'restart_feasibility_assessment',model:'gpt-6-astra',effort:'medium',runtime:'Codex subagent',calls:1,status:'dispatch_reserved',recordedAt:new Date().toISOString(),note:'Assess frozen reference feasibility and execution failures; no new cost retrieval/generation or tuning.'})+'\n');
}else if(command==='finish'){
  if(!fs.existsSync(path.join(root,target,'designer-assessment.json')))throw Error('Assessment artifact absent');
  append({type:'finish',id,actual:{},note:'Assessment artifact saved; design call charged at start.'});
}else throw Error('Use start or finish');
console.log(JSON.stringify(run(['budget',target]).used,null,2));
