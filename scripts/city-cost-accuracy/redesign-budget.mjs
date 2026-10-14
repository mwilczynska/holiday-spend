import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash} from './core.mjs';
import {replayBudget,appendBudget} from './budget.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(fs.realpathSync(repo).toLowerCase()!=='c:\\users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend')throw Error('Wrong worktree');
const root=path.join(repo,'research/city-cost-accuracy'), relative='redesign-1/budget.jsonl';
const parentBytes=fs.readFileSync(path.join(root,'restart-1-prep/budget.jsonl'));
const parent=parentBytes.toString('utf8').trim().split('\n').map(JSON.parse);
const closeout=JSON.parse(fs.readFileSync(path.join(root,'restart-1-prep/closeout.json')));
if(hash(parentBytes)!==closeout.artifacts['restart-1-prep/budget.jsonl'])throw Error('Closed parent journal changed');
const limits={estimateInvocations:400,referenceActions:300,referenceWorkerInvocations:100,estimateRetrievalActions:1600,designInvocations:50,candidateAttempts:20,fullExtensions:2};
const prior=replayBudget(parent,limits);
if(prior.started.length)throw Error('Parent has unfinished calls');
const pending=new Map();
for(const e of parent){if(e.type==='reserve')pending.set(e.id,{...e.resources});else if(e.type==='cancel'||e.type==='finish')pending.delete(e.id);else if(e.type==='start')for(const [k,v]of Object.entries(e.consumed??{}))pending.get(e.id)[k]-=v;}
const append=e=>appendBudget(root,relative,limits,e);
const command=process.argv[2];
if(command==='design-start'){
  if(fs.existsSync(path.join(root,relative)))throw Error('Redesign journal already initialized');
  append({type:'opening',consumed:prior.used,parentJournal:'restart-1-prep/budget.jsonl',parentSha256:hash(parentBytes),note:'Linked cumulative carry-forward, not a resource reset. Parent reservations imported once; old snapshot remains historical.'});
  for(const [id,resources]of pending)append({type:'reserve',id,resources});
  append({type:'cancel',id:'protected-future-assessments',note:'Transfer one of four unused design allocations for owner-authorized redesign; preserve three.'});
  append({type:'reserve',id:'protected-redesign-future-design',resources:{designInvocations:3}});
  append({type:'reserve',id:'redesign-design',resources:{designInvocations:1}});
  append({type:'start',id:'redesign-design',consumed:{designInvocations:1},model:'gpt-6-astra',effort:'medium',runtime:'Codex subagent'});
  const file=path.join(root,'design-dispatches.jsonl'),sequence=fs.readFileSync(file,'utf8').trim().split('\n').length+1;
  fs.appendFileSync(file,JSON.stringify({sequence,phase:'redesign-1',role:'measurement_redesign',task:'redesign_measurement_design',model:'gpt-6-astra',effort:'medium',runtime:'Codex subagent',calls:1,status:'dispatch_reserved',recordedAt:new Date().toISOString(),note:'Owner explicitly authorized one bounded redesign experiment. No cost retrieval or generation.'})+'\n');
}else if(command==='design-finish'){
  if(!fs.existsSync(path.join(root,'redesign-1/design.json')))throw Error('No designer artifact');
  append({type:'finish',id:'redesign-design',actual:{}});
}else if(['repair-start','assessment-start'].includes(command)){
  const events=fs.readFileSync(path.join(root,relative),'utf8').trim().split('\n').map(JSON.parse);
  const role=command.split('-')[0],id=`redesign-${role}`;
  if(events.some(e=>e.id===id))throw Error('Role already registered');
  const book=replayBudget(events,limits);
  if(book.started.length)throw Error('Finish active tasks before design role');
  const reserveId=book.pending.find(p=>p.startsWith('protected-redesign-')&&p.includes('design'));
  const allocation=events.find(e=>e.type==='reserve'&&e.id===reserveId)?.resources.designInvocations;
  if(!allocation)throw Error('No protected design allocation');
  append({type:'cancel',id:reserveId,note:`Transfer one unused allocation to ${role}; preserve the remainder.`});
  if(allocation>1)append({type:'reserve',id:`protected-redesign-after-${role}-design`,resources:{designInvocations:allocation-1}});
  append({type:'reserve',id,resources:{designInvocations:1}});
  append({type:'start',id,consumed:{designInvocations:1},model:'gpt-6-astra',effort:'medium',runtime:'Codex subagent'});
  const file=path.join(root,'design-dispatches.jsonl'),sequence=fs.readFileSync(file,'utf8').trim().split('\n').length+1;
  fs.appendFileSync(file,JSON.stringify({sequence,phase:'redesign-1',role,task:role==='repair'?'redesign_measurement_design':'redesign_measurement_assessment',model:'gpt-6-astra',effort:'medium',runtime:'Codex subagent',calls:1,status:'dispatch_reserved',recordedAt:new Date().toISOString(),note:role==='repair'?'One permitted prospective repair before freeze/source dispatch; no new prices.':'Assess executed frozen redesign; no new acquisition or numerical repair.'})+'\n');
}else if(['repair-finish','assessment-finish'].includes(command)){
  const role=command.split('-')[0],artifact=role==='repair'?'design-repair.json':'designer-assessment.json';
  if(!fs.existsSync(path.join(root,'redesign-1',artifact)))throw Error('No role artifact');
  append({type:'finish',id:`redesign-${role}`,actual:{}});
}else if(command!=='show')throw Error('Use design-start, design-finish or show');
const events=fs.readFileSync(path.join(root,relative),'utf8').trim().split('\n').map(JSON.parse);
console.log(JSON.stringify(replayBudget(events,limits),null,2));
