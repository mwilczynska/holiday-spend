import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hash} from './core.mjs';
import {replayBudget} from './budget.mjs';
import {parseRaw,project,schemaErrors,checkSchema,validateContract,validateFrame,parseResponse,validateProvenance,eligibleRow,pairRows,independence,cityMetrics,decision,taskFor,reservationEvents,LIMITS,canonicalUrl,identity,digestEqual,journalPrefix,replayRecordedTask} from './redesign.mjs';

const design=JSON.parse(fs.readFileSync(new URL('../../research/city-cost-accuracy/redesign-1/contract-input.json',import.meta.url)));
const clone=x=>structuredClone(x),SLOTS=['s1','s2','s3','s4'];
const request=taskFor(design,design.schedule[0],'C:\\synthetic\\tasks\\collect-hanoi').request;
const T='2030-01-01T00:00:00.000Z',stamp=seconds=>new Date(Date.parse(T)+seconds*1000).toISOString();
// All numbers below are abstract mathematical fixture values, never acquired prices.
function row(slot,index=0){return{...clone(design.fixtures.response.rows[0]),slot,sourceUrl:`https://toy${index}.example/menu`,resolvedUrl:`https://toy${index}.example/menu`,sourceTitle:'Toyland menu',retrievedAt:stamp(index*2+5),venueName:`Toyland cafe ${index}`,addressText:`Toyland street ${index}`,geography:'confirmed',geographyEvidence:'Toyland district literal',operatorName:null,menuGroup:null,itemLabel:'Toy cappuccino',sizeText:null,volumeMl:null,serviceMode:'unspecified',listedAmount:100,amountScale:1,currency:'VND',currencyEvidence:'Explicit synthetic VND units',priceEvidence:'Synthetic amount 100',chargeBasis:'unknown',chargeEvidence:null,menuDate:null,dateBasis:'undated',status:'observed',reason:'Synthetic fixture only'};}
function fixture(){
  const slots=SLOTS.map((slot,i)=>({slot,searchRank:i+1,url:`https://toy${i}.example/menu`}));
  const frame={taskId:request.taskId,cityId:request.cityId,results:slots.map(s=>({rank:s.searchRank,title:'Toyland menu',url:s.url,selection:'selected',slot:s.slot,reason:'Synthetic cafe menu'})),slots};
  const actions=[{ordinal:1,type:'search',toolName:'fixture.search',query:request.query,url:null,startedAt:stamp(1),endedAt:stamp(2),outcome:'success',slot:null,resolvedUrl:null,sourceTitle:null,resultNote:'4 fixture results'},...slots.map((s,i)=>({ordinal:i+2,type:'open',toolName:'fixture.open',query:null,url:s.url,startedAt:stamp(i*2+4),endedAt:stamp(i*2+5),outcome:'success',slot:s.slot,resolvedUrl:s.url,sourceTitle:'Toyland menu',resultNote:'Fixture opened'}))];
  const response={schemaVersion:1,taskId:request.taskId,cityId:request.cityId,role:'collect',status:'complete',failureReason:null,actions:actions.map(a=>({ordinal:a.ordinal,type:a.type,query:a.query,url:a.url,at:a.startedAt,outcome:a.outcome})),rows:SLOTS.map(row)};
  const provenance={schemaVersion:1,taskId:request.taskId,cityId:request.cityId,role:'collect',evidenceKind:'worker_recorded_not_native_transcript',recordedAt:stamp(14),frameSavedAt:stamp(3),responseSavedAt:stamp(13),completeActionLog:true,actions};
  const timing={spawnAt:T,terminalAt:stamp(15),firstSpawnAt:T,mtimes:{response:Date.parse(stamp(13)),frame:Date.parse(stamp(3)),provenance:Date.parse(stamp(14))},slots:slots.map(({slot,url})=>({slot,url})),frame};
  return{frame,response,provenance,timing};
}
const parse=(f)=>parseResponse(JSON.stringify(f.response),request,design.schemas.response);
const trace=(f,p=parse(f))=>validateProvenance(JSON.stringify(f.provenance),p,request,design.schemas.provenance,f.timing);

test('accepted exact schemas and unsupported dialect keywords fail closed',()=>{
  assert.equal(validateContract(design),true);for(const[k,s]of Object.entries(design.schemas))if(k!=='dialect')checkSchema(s);
  assert.throws(()=>checkSchema({type:'number',multipleOf:2}),/Unsupported/);
  const d=clone(design);d.status='draft';assert.throws(()=>validateContract(d),/validation/);
});
test('BOM, full fence, duplicate keys, extra content and raw hash semantics',()=>{
  assert.deepEqual(parseRaw('\uFEFF  ```json\n{"a":1}\n```  '),{a:1});
  assert.throws(()=>parseRaw('{"a":1,"\\u0061":2}'),/Duplicate/);
  assert.throws(()=>parseRaw('{"a":{"b":1,"b":2}}'),/Duplicate/);
  assert.throws(()=>parseRaw('prefix {"a":1}'),/Invalid/);
  assert.throws(()=>parseRaw('{"a":1,}'));
  assert.throws(()=>parseRaw('```json\n{}\n```\ntrailing'));
  assert.notEqual(hash(Buffer.from('{}\n')),hash(Buffer.from('{}\r\n')));
  assert(digestEqual(hash('fixture'),hash('fixture').toUpperCase()));assert(!digestEqual(hash('fixture'),hash('altered')));
  assert.equal(parseRaw('{"__proto__":{"a":1}}').__proto__.a,1);
  assert.equal({}.a,undefined);
});
test('normalization only affects declared IDs/enums, not numbers or identity strings',()=>{
  const f=fixture();f.response.taskId=' COLLECT-HANOI ';f.response.cityId='HANOI';f.response.role='COLLECT';f.response.rows[0].slot='S1';f.response.rows[0].currency='vnd';f.response.rows[0].itemLabel='Literal SAME';f.response.rows[0].unexpected='kept only raw';
  const p=parse(f);assert.equal(p.errors.length,0);assert.equal(p.rows[0].row.itemLabel,'Literal SAME');assert.equal(p.rows[0].row.currency,'VND');assert(p.warnings.length);
  f.response.rows[0].listedAmount='100';assert(parse(f).rows[0].errors.length);assert.equal(parse(f).rows[1].errors.length,0);
});
test('granular invalid, duplicate and missing rows never discard valid siblings',()=>{
  const f=fixture();delete f.response.rows[0].priceEvidence;let p=parse(f);assert(p.rows[0].errors.length);assert.equal(p.rows[1].errors.length,0);
  f.response.rows[0]=clone(f.response.rows[1]);p=parse(f);assert(p.rows[0].errors.length);assert(p.rows[1].errors.length);assert.equal(p.rows[2].errors.length,0);
  f.response.taskId='wrong';assert(parse(f).errors.length);assert(parseResponse('{',request,design.schemas.response).errors.length);
});
test('frames preserve unaffected selected faults and mask only broken slots',()=>{
  const f=fixture();let v=validateFrame(JSON.stringify(f.frame),request,design.schemas.frame);assert.deepEqual(v.errors,[]);assert.equal(Object.values(v.slotErrors).flat().length,0);
  delete f.frame.results[0].title;v=validateFrame(JSON.stringify(f.frame),request,design.schemas.frame);assert.equal(v.errors.length,0);assert(v.slotErrors.s1.length);assert.equal(v.slotErrors.s2.length,0);
  f.frame.results[0].rank=8;assert(validateFrame(JSON.stringify(f.frame),request,design.schemas.frame).errors.length);
});
test('unselected malformed pre-selection makes frame unauditable; later diagnostic survives',()=>{
  const f=fixture();f.frame.results.push({rank:5,title:null,url:'https://later.example',selection:'beyond_four',slot:null,reason:'synthetic'});
  let v=validateFrame(JSON.stringify(f.frame),request,design.schemas.frame);assert.equal(v.errors.length,0);assert(v.warnings.length);
  f.frame.results[0]={rank:1,title:null,url:'https://first.example',selection:'not_cafe',slot:null,reason:'synthetic'};
  v=validateFrame(JSON.stringify(f.frame),request,design.schemas.frame);assert(v.errors.length);
});
test('valid worker-recorded source binding, timestamps and all four eligible rows',()=>{
  const f=fixture(),p=parse(f),t=trace(f,p);assert.deepEqual(t.errors,[]);assert.deepEqual(t.protocol,[]);assert.equal(t.knownActions,5);
  for(const item of p.rows)assert.equal(eligibleRow(item,request,f.timing.slots.find(s=>s.slot===item.slot),t).eligible,true);
  assert.equal(schemaErrors(design.fixtures.provenance,design.schemas.provenance).length,0);
});
test('unknown, malformed or incomplete provenance gets full-cap accounting',()=>{
  const f=fixture();f.provenance.completeActionLog=false;assert.equal(trace(f).knownActions,null);
  f.provenance.completeActionLog=true;f.provenance.actions[1].ordinal=5;assert.equal(trace(f).knownActions,null);
  assert.equal(validateProvenance('{',parse(f),request,design.schemas.provenance,f.timing).knownActions,null);
  f.provenance.actions[1].ordinal=2;f.timing.mtimes.response+=20;assert.equal(trace(f).knownActions,null);
  for(const raw of ['null','3','[]','{"actions":[null]}'])assert.equal(validateProvenance(raw,parse(f),request,design.schemas.provenance,f.timing).knownActions,null);
});
test('isolated response/open source binding fault excludes only that slot',()=>{
  const f=fixture();f.response.rows[0].resolvedUrl='https://wrong.example/menu';const p=parse(f),t=trace(f,p);
  assert.equal(t.knownActions,5);assert(t.slotErrors.s1.length);assert.equal(t.slotErrors.s2.length,0);
  assert.equal(eligibleRow(p.rows[0],request,f.timing.slots[0],t).eligible,false);assert.equal(eligibleRow(p.rows[1],request,f.timing.slots[1],t).eligible,true);
});
test('known cap, frame-after-open, deadline and acquisition-window breaches invalidate protocol',()=>{
  let f=fixture();f.provenance.actions.push(clone(f.provenance.actions.at(-1)));assert(trace(f).protocol.some(e=>e.includes('cap')));
  f=fixture();f.provenance.frameSavedAt=stamp(6);f.timing.mtimes.frame=Date.parse(stamp(6));assert(trace(f).protocol.some(e=>e.includes('Frame')));
  f=fixture();f.provenance.actions[4].endedAt=stamp(601);assert(trace(f).protocol.some(e=>e.includes('deadline')));
  f=fixture();f.timing.terminalAt=stamp(48*3600+1);assert(trace(f).protocol.some(e=>e.includes('48 hour')));
});
test('identity comparison is literal NFC/case/whitespace only with null distinct',()=>{
  const a=row('s1'),b=clone(a);b.itemLabel='  TOY   CAPPUCCINO ';assert.equal(pairRows(a,b).eligible,true);
  b.itemLabel='Toy capuchino';assert.equal(pairRows(a,b).eligible,false);b.itemLabel=a.itemLabel;b.sizeText='unspecified';assert.equal(pairRows(a,b).eligible,false);
  b.sizeText=null;b.chargeBasis='additional_explicit';assert.equal(pairRows(a,b).eligible,true);assert(pairRows(a,b).chargeBasisDisagreement);
  assert.equal(identity('Cafe\u0301'),identity('CAFÉ'));assert.notEqual(identity(null),identity('null'));
  assert.equal(canonicalUrl('HTTPS://EXAMPLE.TEST:443/menu?a=1#x'),'https://example.test/menu?a=1');
});
test('operator/menu dependency is normalized; null does not imply shared ownership',()=>{
  const rows=SLOTS.map(row);assert.equal(independence(rows).independent,true);
  rows[0].menuGroup=' Toy  Brand ';rows[1].menuGroup='toy brand';assert.equal(independence(rows).independent,false);
  rows[0].menuGroup=null;rows[1].menuGroup=null;rows[0].operatorName='Toy Owner';rows[1].operatorName='TOY OWNER';assert.equal(independence(rows).independent,false);
});
test('all declared mathematical fixtures, enumerations and threshold equality',()=>{
  const flat=cityMetrics([100,100,100,100],[100,100,100,100]);assert.equal(flat.R,0);assert.equal(flat.S,0);assert.equal(flat.U,0);assert.equal(flat.subsets.length,6);assert.equal(flat.partitions.length,3);assert.equal(flat.leaveOneOut.length,4);assert.equal(decision([flat,flat,flat]).verdict,'pass_listed_price_precision_only');
  const split=cityMetrics([100,100,200,200],[100,100,200,200]);assert(Math.abs(split.S-Math.log(2)/2)<1e-12);assert(Math.abs(split.D-Math.log(2))<1e-12);assert(Math.abs(split.L-Math.log(2)/6)<1e-12);assert.equal(decision([split,split,split]).verdict,'fail_precision');
  const mismatch=cityMetrics([100,100,100,100],[102,102,102,102]);assert(Math.abs(mismatch.R-Math.log(1.02))<1e-12);assert.equal(decision([mismatch,mismatch,mismatch]).verdict,'fail_precision');
  const edge=[-.025,-.025,.025,.025].map(Math.exp),boundary=cityMetrics(edge,edge);assert.equal(decision([boundary,boundary,boundary]).verdict,'pass_listed_price_precision_only');
  const missing=cityMetrics([100,100,100,null],[100,100,100,null]);assert.equal(missing.U,null);assert.equal(decision([flat,flat,missing]).B,null);assert.equal(decision([flat,flat,missing]).verdict,'inconclusive_missing_evidence');
  assert.equal(decision([flat,flat,flat],{identityDisputes:1}).verdict,'inconclusive_missing_evidence');assert.equal(decision([flat,flat,flat],{invalidProtocol:true}).verdict,'invalid_protocol');
});
test('blind verifier prompt includes complete explicit schemas and only permitted assignment',()=>{
  const slots=SLOTS.map((slot,i)=>({slot,url:i?'https://toy.example/menu':null})),t=taskFor(design,design.schedule[1],'C:\\synthetic\\verify',slots);
  assert.deepEqual(Object.keys(t.request.assignment),['taskId','cityId','city','country','area','currency','query','slots','outputDirectory','maxActions']);
  assert(t.prompt.includes(JSON.stringify(design.schemas.response,null,2)));assert(t.prompt.includes(JSON.stringify(design.schemas.provenance,null,2)));assert(t.prompt.includes(design.identityExtraction));assert(!t.prompt.includes('"listedAmount": 100'));assert(!t.prompt.includes('{{'));assert(!t.prompt.includes('\r'));
  assert.equal(t.request.promptSha256,hash(t.prompt));
});
test('prospective transfer preserves cumulative actuals and confirmation reserves',()=>{
  const events=[{sequence:1,type:'opening',consumed:{estimateInvocations:19,referenceActions:73,referenceWorkerInvocations:13,estimateRetrievalActions:44,designInvocations:6,candidateAttempts:0,fullExtensions:0}},
    {sequence:2,type:'reserve',id:'protected-reference-development',resources:{referenceActions:80,referenceWorkerInvocations:20}},
    {sequence:3,type:'reserve',id:'protected-reference-confirmation',resources:{referenceActions:80,referenceWorkerInvocations:16}},
    {sequence:4,type:'reserve',id:'protected-estimate-confirmationexclusive',resources:{estimateInvocations:100,estimateRetrievalActions:300}}];
  const before=replayBudget(events,LIMITS),out=reservationEvents(events,design),afterEvents=[...events,...out.map((e,i)=>({...e,sequence:events.length+i+1}))],after=replayBudget(afterEvents,LIMITS);
  assert.deepEqual(after.used,before.used);assert.deepEqual(after.reserved,before.reserved);assert.equal(out.filter(e=>e.type==='reserve'&&e.id.startsWith('collect-')).reduce((n,e)=>n+e.resources.referenceActions,0),15);
  assert(!out.some(e=>e.id.includes('confirmation')));assert.throws(()=>reservationEvents(afterEvents,design),/Insufficient|already/);
  const started=[...afterEvents,{sequence:afterEvents.length+1,type:'start',id:'collect-hanoi',consumed:{referenceWorkerInvocations:1}}];const terminal=[...started,{sequence:started.length+1,type:'finish',id:'collect-hanoi',actual:null}];assert.equal(replayBudget(terminal,LIMITS).used.referenceActions,before.used.referenceActions+5);
});
test('immutable summary prefix survives lawful later assessment accounting',()=>{
  const original=[{sequence:1,type:'opening',consumed:{designInvocations:6}},{sequence:2,type:'reserve',id:'assessment',resources:{designInvocations:1}}],encode=events=>Buffer.from(events.map(JSON.stringify).join('\n')+'\n');
  const before=journalPrefix(encode(original)),later=[...original,{sequence:3,type:'start',id:'assessment',consumed:{designInvocations:1}},{sequence:4,type:'finish',id:'assessment',actual:{}}];
  const replay=journalPrefix(encode(later),2);assert.equal(hash(before.bytes),hash(replay.bytes));assert.deepEqual(before.state,replay.state);assert.equal(journalPrefix(encode(later)).state.used.designInvocations,7);
  later[3].actual={designInvocations:1};assert.throws(()=>journalPrefix(encode(later),2),/exceeded/);
});

test('offline task replay binds recorded chronology without current filesystem times',()=>{
  const f=fixture(),raw=Object.fromEntries(['frame','response','provenance'].map(k=>[k,Buffer.from(JSON.stringify(f[k]))]));
  const metadata={spawnAt:T,terminalAt:stamp(15),firstSpawnAt:T,originalFileMtimes:f.timing.mtimes,captureStable:true};
  const replay=replayRecordedTask(raw,request,design,metadata);
  assert.deepEqual(replay.errors,[]);assert.equal(replay.knownActions,5);assert.equal(replay.rows.filter(r=>r.eligible).length,4);
  const altered=clone(metadata);altered.originalFileMtimes.response+=20;
  assert.equal(replayRecordedTask(raw,request,design,altered).knownActions,null);
});
