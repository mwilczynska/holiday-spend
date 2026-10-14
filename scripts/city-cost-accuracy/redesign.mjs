import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {hash,safePath,writeOnce} from './core.mjs';
import {replayBudget,appendBudget} from './budget.mjs';

// Offline only. No providers, persistence, retrieval, or scientific repair.
export const AUTHORIZED_REPO='C:\\Users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend';
export const LIMITS={estimateInvocations:400,referenceActions:300,referenceWorkerInvocations:100,estimateRetrievalActions:1600,designInvocations:50,candidateAttempts:20,fullExtensions:2};
const SLOTS=['s1','s2','s3','s4'], CITIES=['hanoi','oaxaca','copenhagen'];
const need=(x,m)=>{if(!x)throw Error(m);}, obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const iso=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
const json=x=>JSON.stringify(x,null,2)+'\n';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export const identity=x=>x===null?null:typeof x==='string'?x.normalize('NFC').toLowerCase().trim().replace(/\s+/gu,' '):undefined;
export const digestEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/i.test(a)&&/^[a-f0-9]{64}$/i.test(b)&&a.toLowerCase()===b.toLowerCase();
export function canonicalUrl(x){try{const u=new URL(x);if(!['http:','https:'].includes(u.protocol))return null;u.hash='';return u.href;}catch{return null;}}
const hostname=x=>{try{return new URL(x).hostname.replace(/^www\./,'');}catch{return null;}};

// Recursive JSON reader rejects duplicate decoded keys (including escaped duplicates).
export function parseRaw(raw){
  let s=Buffer.isBuffer(raw)?raw.toString('utf8'):raw;
  need(typeof s==='string','Expected raw bytes or string');
  s=s.replace(/^\uFEFF/,'').trim();
  if(s.startsWith('```')){const m=s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);need(m,'Only one complete JSON fence allowed');s=m[1].trim();}
  let i=0;const ws=()=>{while(/\s/.test(s[i]??'')&&i<s.length)i++;};
  const string=()=>{const start=i++;while(i<s.length){if(s[i]==='\\'){i+=2;continue;}if(s[i++]==='"')return JSON.parse(s.slice(start,i));}throw Error('Unterminated JSON string');};
  const value=()=>{ws();if(s[i]==='"')return string();if(s[i]==='{'){i++;ws();const out={},keys=new Set();if(s[i]==='}'){i++;return out;}for(;;){ws();need(s[i]==='"','Expected JSON key');const k=string();need(!keys.has(k),`Duplicate JSON key: ${k}`);keys.add(k);ws();need(s[i++]===':','Expected colon');Object.defineProperty(out,k,{value:value(),enumerable:true,writable:true,configurable:true});ws();if(s[i++]==='}')return out;need(s[i-1]===',','Expected object separator');}}
    if(s[i]==='['){i++;ws();const out=[];if(s[i]===']'){i++;return out;}for(;;){out.push(value());ws();if(s[i++]===']')return out;need(s[i-1]===',','Expected array separator');}}
    const m=s.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);need(m,'Invalid JSON value');i+=m[0].length;return JSON.parse(m[0]);};
  const result=value();ws();need(i===s.length,'Trailing JSON content');return result;
}

const KEYWORDS=new Set(['type','properties','required','additionalProperties','items','minItems','maxItems','minimum','maximum','exclusiveMinimum','enum','const']);
export function checkSchema(schema){
  need(obj(schema),'Schema must be object');for(const k of Object.keys(schema))need(KEYWORDS.has(k),`Unsupported schema keyword: ${k}`);
  if(schema.type)need([schema.type].flat().every(t=>['object','array','string','number','integer','null','boolean'].includes(t)),'Unsupported schema type');
  if(schema.properties)for(const x of Object.values(schema.properties))checkSchema(x);
  if(schema.items)checkSchema(schema.items);
  if(schema.additionalProperties!==undefined)need(schema.additionalProperties===false,'Only closed object schemas supported');
}
export function project(value,schema,pointer='$',warnings=[]){
  if(obj(value)&&schema.properties){const out={};for(const[k,v]of Object.entries(value)){if(schema.properties[k])out[k]=project(v,schema.properties[k],`${pointer}.${k}`,warnings);else warnings.push(`Unknown field ignored: ${pointer}.${k}`);}return out;}
  if(Array.isArray(value)&&schema.items)return value.map((v,i)=>project(v,schema.items,`${pointer}[${i}]`,warnings));
  if(typeof value==='string'){
    if(['taskId','cityId','role','status','slot'].includes(pointer.split('.').at(-1)))value=value.trim().replace(/[A-Z]/g,c=>c.toLowerCase());
    if(schema.enum){const match=schema.enum.find(x=>typeof x==='string'&&x.toLowerCase()===value.trim().toLowerCase());if(match!==undefined)value=match;}
  }
  return value;
}
export function schemaErrors(value,schema,p='$'){
  const e=[], fail=m=>e.push(`${p}: ${m}`);
  if(schema.type){const matches=t=>t==='null'?value===null:t==='object'?obj(value):t==='array'?Array.isArray(value):t==='integer'?Number.isSafeInteger(value):t==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===t;if(![schema.type].flat().some(matches))return[`${p}: invalid type`];}
  if(schema.enum&&!schema.enum.some(x=>equal(x,value)))fail('invalid enum');
  if(Object.hasOwn(schema,'const')&&!equal(value,schema.const))fail('invalid const');
  if(typeof value==='number'){if(schema.minimum!==undefined&&value<schema.minimum)fail('below minimum');if(schema.maximum!==undefined&&value>schema.maximum)fail('above maximum');if(schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum)fail('below exclusive minimum');}
  if(obj(value)){for(const k of schema.required??[])if(!Object.hasOwn(value,k))fail(`missing ${k}`);for(const[k,v]of Object.entries(value)){if(schema.properties?.[k])e.push(...schemaErrors(v,schema.properties[k],`${p}.${k}`));else if(schema.additionalProperties===false)fail(`unknown ${k}`);}}
  if(Array.isArray(value)){if(schema.minItems!==undefined&&value.length<schema.minItems)fail('too few items');if(schema.maxItems!==undefined&&value.length>schema.maxItems)fail('too many items');if(schema.items)value.forEach((v,i)=>e.push(...schemaErrors(v,schema.items,`${p}[${i}]`)));}return e;
}

export function cityMetrics(a,b){
  if(a.length!==4||b.length!==4||![...a,...b].every(v=>Number.isFinite(v)&&v>0))return{complete:false,R:null,S:null,D:null,L:null,U:null};
  const la=a.map(Math.log),lb=b.map(Math.log),x=la.map((v,i)=>(v+lb[i])/2),mu=mean(x);
  const subsets=[];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)subsets.push({slots:[SLOTS[i],SLOTS[j]],meanLog:(x[i]+x[j])/2});
  const partitions=[[0,1,2,3],[0,2,1,3],[0,3,1,2]].map(([i,j,k,l])=>({halves:[[SLOTS[i],SLOTS[j]],[SLOTS[k],SLOTS[l]]],contrast:Math.abs((x[i]+x[j]-x[k]-x[l])/2)}));
  const leaveOneOut=x.map((_,i)=>({omitted:SLOTS[i],meanLog:mean(x.filter((_,j)=>i!==j))}));
  const R=Math.max(...la.map((v,i)=>Math.abs(v-lb[i]))),S=Math.max(...subsets.map(v=>Math.abs(v.meanLog-mu)));
  return{complete:true,mu,reference:Math.exp(mu),collectorCentre:Math.exp(mean(la)),verifierCentre:Math.exp(mean(lb)),exactAmountMatches:a.filter((v,i)=>v===b[i]).length,R,S,D:Math.max(...partitions.map(v=>v.contrast)),L:Math.max(...leaveOneOut.map(v=>Math.abs(v.meanLog-mu))),U:S+R,logRange:Math.max(...x)-Math.min(...x),subsets,partitions,leaveOneOut};
}
export function decision(metrics,{invalidProtocol=false,identityDisputes=0}={}){
  const complete=metrics.length===3&&metrics.every(v=>v.complete),U_macro=complete?mean(metrics.map(v=>v.U)):null,B=complete?2*U_macro:null,tol=1e-12;
  const verdict=invalidProtocol?'invalid_protocol':!complete||identityDisputes?'inconclusive_missing_evidence':metrics.some(v=>v.R>Math.log(1.01)+tol||v.U>0.025+tol)||B>0.05+tol?'fail_precision':'pass_listed_price_precision_only';
  return{verdict,U_macro,B,minimumFutureCentralGain:B===null?null:0.10+B};
}

export function expand(template,values){let out=template;for(const[k,v]of Object.entries(values))out=out.split(`{{${k}}}`).join(typeof v==='string'?v:JSON.stringify(v,null,2));need(!/\{\{[^}]+\}\}/.test(out),'Unexpanded placeholder');return out.replace(/\r\n/g,'\n');}
export function taskFor(design,spec,outputDirectory,slots=null){
  const city=design.cities.find(v=>v.id===spec.cityId);need(city,'Unknown city');
  const assignment={taskId:spec.taskId,cityId:city.id,city:city.name,country:city.country,area:city.area,currency:city.currency,query:spec.query,slots,outputDirectory,maxActions:spec.maxActions};
  const system=design.prompts.system.replace(/\r\n/g,'\n'),prompt=expand(design.prompts[spec.promptTemplate],{ASSIGNMENT_JSON:assignment,DEFINITION:design.definition,SELECTION:design.selection,FRAME_SCHEMA_JSON:design.schemas.frame,RESPONSE_SCHEMA_JSON:design.schemas.response,PROVENANCE_SCHEMA_JSON:design.schemas.provenance,IDENTITY_EXTRACTION:design.identityExtraction,PROVENANCE_DELIVERY:design.provenanceDelivery});
  return{system,prompt,request:{...spec,...design.worker,assignment,systemSha256:hash(system),promptSha256:hash(prompt)}};
}

export function validateFrame(raw,request,schema){
  const warnings=[],errors=[],slotErrors=Object.fromEntries(SLOTS.map(s=>[s,[]]));let frame;
  try{frame=project(parseRaw(raw),schema,'$',warnings);}catch(e){return{frame:null,errors:[e.message],slotErrors,warnings};}
  if(!obj(frame)||frame.taskId!==request.taskId||frame.cityId!==request.cityId||!Array.isArray(frame.slots)||!Array.isArray(frame.results))errors.push('Invalid frame envelope');
  if(errors.length)return{frame,errors,slotErrors,warnings};
  const top={...schema,properties:{...schema.properties,slots:{type:'array'},results:{type:'array'}}};errors.push(...schemaErrors(frame,top));
  const ranks=new Map(),selected=new Map();const highest=Math.max(0,...frame.slots.map(s=>Number.isSafeInteger(s?.searchRank)?s.searchRank:0));
  for(const[index,r]of frame.results.entries()){
    const e=schemaErrors(r,schema.properties.results.items);
    if(!obj(r)||!Number.isSafeInteger(r.rank)||r.rank!==index+1)errors.push('Rank order does not cover 1..N');
    const linked=frame.slots.filter(s=>s?.searchRank===r?.rank||s?.slot===r?.slot).map(s=>s.slot).filter(s=>SLOTS.includes(s));
    if(ranks.has(r?.rank)){for(const s of [...linked,...ranks.get(r.rank)])slotErrors[s].push('Duplicate result rank');}else ranks.set(r?.rank,linked);
    if(e.length){if(r?.selection==='selected')for(const s of linked)slotErrors[s].push('Malformed selected result');else if(!Number.isSafeInteger(r?.rank)||r.rank<=highest)errors.push('Malformed unselected result before selected frame');else warnings.push('Malformed unselected result after selected frame');}
    if(r?.selection==='selected'&&SLOTS.includes(r.slot)){if(selected.has(r.slot))slotErrors[r.slot].push('Duplicate selection');selected.set(r.slot,r);}
  }
  if(frame.results.length>10)errors.push('Too many ranked results');
  const seen=new Set();for(const s of frame.slots){if(!SLOTS.includes(s?.slot)){errors.push('Unknown frame slot');continue;}if(seen.has(s.slot))slotErrors[s.slot].push('Duplicate frame slot');seen.add(s.slot);slotErrors[s.slot].push(...schemaErrors(s,schema.properties.slots.items));const r=selected.get(s.slot);if(s.url===null){if(s.searchRank!==null||r)slotErrors[s.slot].push('Invalid absent slot');}else if(!canonicalUrl(s.url)||!r||r.rank!==s.searchRank||canonicalUrl(r.url)!==canonicalUrl(s.url))slotErrors[s.slot].push('Selection/slot mismatch');}
  for(const s of SLOTS)if(!seen.has(s))slotErrors[s].push('Missing frame slot');
  for(const s of frame.slots)if(Number.isSafeInteger(s?.searchRank)){const duplicate=frame.slots.filter(t=>t?.slot!==s.slot&&t?.searchRank===s.searchRank);if(duplicate.length)for(const t of [s,...duplicate])if(SLOTS.includes(t.slot))slotErrors[t.slot].push('Crossed/duplicate slot rank');}
  for(const s of frame.slots)if(s?.url!==null&&canonicalUrl(s?.url)){const duplicate=frame.slots.filter(t=>t?.slot!==s.slot&&canonicalUrl(t?.url)===canonicalUrl(s.url));if(duplicate.length)for(const t of [s,...duplicate])if(SLOTS.includes(t.slot))slotErrors[t.slot].push('Duplicate selected URL');}
  return{frame,errors,slotErrors,warnings};
}

export function parseResponse(raw,request,schema){
  const warnings=[],errors=[];let record;try{record=project(parseRaw(raw),schema,'$',warnings);}catch(e){return{record:null,errors:[e.message],rows:SLOTS.map(slot=>({slot,row:null,errors:['Unparseable response']})),warnings};}
  if(!obj(record)||record.taskId!==request.taskId||record.cityId!==request.cityId||record.role!==request.role||!Array.isArray(record.rows))errors.push('Invalid response envelope');
  if(!errors.length){const top={...schema,properties:{...schema.properties,rows:{type:'array'},actions:{type:'array'}}};errors.push(...schemaErrors(record,top));}
  const rows=SLOTS.map(slot=>{const matches=Array.isArray(record?.rows)?record.rows.filter(r=>r?.slot===slot):[],errors=matches.length!==1?['Missing/duplicate slot']:schemaErrors(matches[0],schema.properties.rows.items);if(matches.length===1&&matches[0].status!=='observed'&&matches[0].listedAmount!==null)errors.push('Non-observed amount must be null');return{slot,row:matches.length===1?matches[0]:null,errors};});
  if(record?.rows?.some(r=>!SLOTS.includes(r?.slot)))warnings.push('Unknown row slot retained in raw');
  return{record,errors,rows,warnings};
}

export function pairRows(a,b){
  const disputes=[];for(const k of ['itemLabel','sizeText','venueName','addressText'])if(identity(a[k])!==identity(b[k]))disputes.push(k);
  for(const k of ['serviceMode','currency','amountScale','dateBasis'])if(a[k]!==b[k])disputes.push(k);
  if(canonicalUrl(a.resolvedUrl)!==canonicalUrl(b.resolvedUrl))disputes.push('resolvedUrl');
  return{eligible:!disputes.length,disputes,chargeBasisDisagreement:a.chargeBasis!==b.chargeBasis};
}
export function independence(rows){
  const dimensions={domain:rows.map(r=>hostname(r.resolvedUrl)),venue:rows.map(r=>identity(r.venueName)),operator:rows.map(r=>identity(r.operatorName)),menu:rows.map(r=>identity(r.menuGroup))};
  const diagnostics=Object.fromEntries(Object.entries(dimensions).map(([k,v])=>[k,{unique:new Set(v.filter(nonempty)).size,unknown:v.filter(x=>!nonempty(x)).length,overlap:v.filter((x,i)=>nonempty(x)&&v.indexOf(x)!==i)}]));
  return{independent:rows.length===4&&diagnostics.domain.unique===4&&diagnostics.venue.unique===4&&!diagnostics.operator.overlap.length&&!diagnostics.menu.overlap.length,dimensions:diagnostics};
}

export function validateProvenance(raw,parsed,request,schema,{spawnAt,terminalAt,mtimes,slots,frame=null,firstSpawnAt=spawnAt}){
  const errors=[],protocol=[],warnings=[],slotErrors=Object.fromEntries(SLOTS.map(s=>[s,[]]));let evidence;
  const miss=m=>errors.push(m),bad=m=>protocol.push(m),stamp=x=>iso(x)&&Date.parse(x)>=Date.parse(spawnAt)&&Date.parse(x)<=Date.parse(spawnAt)+600000;
  try{evidence=project(parseRaw(raw),schema,'$',warnings);}catch(e){return{evidence:null,errors:[e.message],protocol,warnings,slotErrors,knownActions:null};}
  errors.push(...schemaErrors(evidence,schema));
  if(!obj(evidence))return{evidence,errors,protocol,warnings,slotErrors,knownActions:null};
  if(evidence?.taskId!==request.taskId||evidence?.cityId!==request.cityId||evidence?.role!==request.role)miss('Provenance envelope mismatch');
  const actions=Array.isArray(evidence?.actions)?evidence.actions:[];
  if(actions.length>request.maxActions)bad('Known action cap breach');
  if(evidence?.completeActionLog!==true)miss('Incomplete action log');
  if(!iso(spawnAt)||!iso(terminalAt))miss('Coordinator interval missing');
  if(!iso(evidence?.responseSavedAt)||!Number.isFinite(mtimes?.response)||Math.abs(Date.parse(evidence.responseSavedAt)-mtimes.response)>1)miss('Response mtime discrepancy');
  if(!iso(evidence?.recordedAt)||Date.parse(evidence.recordedAt)<Date.parse(evidence.responseSavedAt))miss('Invalid snapshot chronology');
  if(Number.isFinite(mtimes?.response)&&mtimes.response>Date.parse(spawnAt)+600000)bad('Response after deadline');
  if(Number.isFinite(mtimes?.provenance)&&mtimes.provenance>Date.parse(spawnAt)+600000)bad('Provenance after deadline');
  if(Number.isFinite(mtimes?.response)&&mtimes.response<Date.parse(spawnAt))miss('Response predates spawn');
  if(Date.parse(terminalAt)>Date.parse(firstSpawnAt)+48*3600000)bad('48 hour acquisition window exceeded');
  const opens=slots.filter(s=>s.url!==null),expected=request.role==='collect'?[{type:'search',query:request.query,url:null,slot:null},...opens.map(s=>({type:'open',query:null,url:s.url,slot:s.slot}))]:opens.map(s=>({type:'open',query:null,url:s.url,slot:s.slot}));
  if(!Array.isArray(parsed.record?.actions)||parsed.record.actions.length!==actions.length)miss('Action count cannot be reconciled');
  let previous=Date.parse(spawnAt);
  for(const[aIndex,a]of actions.entries()){
    const exp=expected[aIndex],response=parsed.record?.actions?.[aIndex];
    if(!obj(a)){miss('Invalid action');continue;}
    if(a.ordinal!==aIndex+1||!exp||a.type!==exp.type||a.slot!==exp.slot||a.query!==exp.query||canonicalUrl(a.url)!==canonicalUrl(exp.url))miss('Action count/order cannot be reconciled');
    if(a.type==='search'&&a.url!==null)miss('Search URL must be null');
    if(!nonempty(a.toolName))miss('Missing tool identity');
    if(!stamp(a.startedAt)||!stamp(a.endedAt)||Date.parse(a.startedAt)>Date.parse(a.endedAt)||Date.parse(a.startedAt)<previous){miss('Invalid action chronology');if(iso(a.startedAt)&&Date.parse(a.startedAt)>Date.parse(spawnAt)+600000||iso(a.endedAt)&&Date.parse(a.endedAt)>Date.parse(spawnAt)+600000)bad('Action after deadline');}
    previous=Date.parse(a.endedAt);
    const matches=response&&response.ordinal===a.ordinal&&response.type===a.type&&response.query===a.query&&canonicalUrl(response.url)===canonicalUrl(a.url)&&(a.type!=='search'||response.url===null)&&response.outcome===a.outcome&&response.at===a.startedAt;
    if(!matches){if(SLOTS.includes(a.slot))slotErrors[a.slot].push('Response/provenance action mismatch');else miss('Search action mismatch');}
    if(a.type==='search'&&(a.resolvedUrl!==null||a.sourceTitle!==null))miss('Search action has source URL/title');
  }
  if(actions.length&&Date.parse(evidence.responseSavedAt)<Date.parse(actions.at(-1)?.endedAt))miss('Response precedes final action');
  if(request.role==='collect'){
    if(!iso(evidence.frameSavedAt)||!Number.isFinite(mtimes?.frame)||Math.abs(Date.parse(evidence.frameSavedAt)-mtimes.frame)>1)miss('Frame mtime discrepancy');
    const search=actions[0],open=actions.find(a=>a?.type==='open');
    if(!search||search.type!=='search'||!iso(evidence.frameSavedAt)||Date.parse(evidence.frameSavedAt)<Date.parse(search.endedAt))miss('Missing selection chronology');
    if(open&&Number.isFinite(mtimes?.frame)&&mtimes.frame>Date.parse(open.startedAt))bad('Frame written after open');
    if(open&&iso(evidence.frameSavedAt)&&Date.parse(evidence.frameSavedAt)>Date.parse(open.startedAt))bad('Frame timestamp after open');
    if(!frame)miss('Missing frozen frame');
  }else if(evidence.frameSavedAt!==null)miss('Verifier frame timestamp must be null');
  for(const item of parsed.rows){
    const row=item.row;if(!row||row.status!=='observed')continue;
    const open=actions.filter(a=>a?.type==='open'&&a.slot===item.slot&&a.outcome==='success'&&canonicalUrl(a.url)===canonicalUrl(row.sourceUrl));
    if(open.length!==1||canonicalUrl(open[0]?.resolvedUrl)!==canonicalUrl(row.resolvedUrl)||row.retrievedAt!==open[0]?.endedAt)slotErrors[item.slot].push('Row/action source binding failed');
  }
  return{evidence,errors,protocol,warnings,slotErrors,knownActions:errors.length?null:actions.length};
}

export function eligibleRow(item,request,slot,trace){
  const errors=[...item.errors,...(trace.slotErrors?.[slot.slot]??[])],r=item.row;
  if(!r)return{...item,eligible:false,errors};
  if(trace.errors.length)errors.push('Task provenance untraceable');
  if(r.status!=='observed'||r.geography!=='confirmed')errors.push('Not observed in assigned geography');
  if(!(Number.isFinite(r.listedAmount)&&r.listedAmount>0)||![1,1000].includes(r.amountScale)||r.currency!==request.assignment.currency)errors.push('Invalid price/scale/currency');
  for(const k of ['priceEvidence','currencyEvidence','geographyEvidence','itemLabel','venueName','addressText','sourceUrl','resolvedUrl','retrievedAt'])if(!nonempty(r[k]))errors.push(`Missing evidence: ${k}`);
  for(const k of ['itemLabel','sizeText','venueName','addressText','operatorName','menuGroup'])if(r[k]!==null&&!nonempty(r[k]))errors.push(`Empty identity: ${k}`);
  if(!['dine_in','unspecified'].includes(r.serviceMode)||!['dated','undated'].includes(r.dateBasis))errors.push('Ineligible mode/date');
  if(!slot.url||canonicalUrl(r.sourceUrl)!==canonicalUrl(slot.url)||!canonicalUrl(r.resolvedUrl)||!iso(r.retrievedAt))errors.push('Assigned source/timestamp mismatch');
  return{...item,eligible:!errors.length,errors};
}

// Scientific text is frozen as well as schemas. These guards intentionally accept one exact design only.
export function validateContract(d,{accepted=true}={}){
  need(d.schemaVersion===1&&d.experimentId==='redesign-1','Wrong design');
  if(accepted)need(d.status==='coordinator_validated'&&d.coordinatorValidation?.validated===true&&iso(d.coordinatorValidation.validatedAt)&&nonempty(d.coordinatorValidation.validatedBy),'Explicit coordinator validation required');
  need(equal(d.cities.map(c=>c.id),CITIES),'Unexpected cities');
  need(d.worker.model==='gpt-6-luna'&&d.worker.effort==='max'&&d.worker.runtime==='Codex subscription subagent'&&d.worker.maxSeconds===600&&d.worker.maxConcurrency===3&&d.worker.retries===0&&d.worker.paidCalls===0&&d.worker.substitutions===false&&d.worker.freshContext===true,'Unsupported worker contract');
  need(d.schedule.length===6&&d.schedule.reduce((n,s)=>n+s.maxActions,0)===27,'Unexpected schedule');
  for(const c of d.cities)for(const role of ['collect','verify']){const t=d.schedule.find(s=>s.taskId===`${role}-${c.id}`);need(t?.cityId===c.id&&t.role===role&&t.maxActions===(role==='collect'?5:4)&&t.query===(role==='collect'?c.query:null)&&equal(t.dependsOn,role==='collect'?[]:[`collect-${c.id}`]),'Unsupported task specification');}
  for(const[k,v]of Object.entries(d.schemas))if(k!=='dialect')checkSchema(v);
  need(d.hypothesis.practicalMargin===0.1&&d.budget.newMaximum.estimateInvocations===0&&d.budget.newMaximum.referenceActions===27&&d.budget.newMaximum.referenceWorkers===6,'Unexpected scientific/budget contract');
  need(equal(d.decision.precedence,['invalid_protocol','inconclusive_missing_evidence','fail_precision','pass_listed_price_precision_only']),'Unsupported precedence');
  need(d.schemas.provenance&&nonempty(d.identityExtraction)&&nonempty(d.provenanceDelivery),'Provenance design repair required before execution');
  return true;
}

const SOURCE_PATHS=['scripts/city-cost-accuracy/redesign.mjs','scripts/city-cost-accuracy/redesign.test.mjs','scripts/city-cost-accuracy/core.mjs','scripts/city-cost-accuracy/budget.mjs','scripts/city-cost-accuracy/redesign-budget.mjs','scripts/city-cost-accuracy/materialize-redesign.mjs'];
function context(){const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');need(fs.realpathSync(repo).toLowerCase()===AUTHORIZED_REPO.toLowerCase(),'Wrong worktree');const root=path.join(repo,'research/city-cost-accuracy/redesign-1');return{repo,root};}
const read=p=>parseRaw(fs.readFileSync(p));
function lock(ctx,fn){const p=safePath(ctx.root,'coordinator.lock'),fd=fs.openSync(p,'wx');try{return fn();}finally{fs.closeSync(fd);fs.unlinkSync(p);}}
function bytesOnce(root,relative,bytes){const target=safePath(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){need(fs.readFileSync(target).equals(bytes),`Immutable bytes differ: ${relative}`);return;}fs.writeFileSync(target,bytes,{flag:'wx'});}
function validateDesignerBinding(ctx,d){const original=fs.readFileSync(safePath(ctx.root,'design.json')),patchBytes=fs.readFileSync(safePath(ctx.root,'design-repair.json')),patch=parseRaw(patchBytes),expected=parseRaw(original);need(hash(original)===patch.originalDesignSha256,'Original design hash mismatch');for(const op of patch.operations){need(['add','replace'].includes(op.op)&&op.path.startsWith('/'),'Unsupported designer patch');const keys=op.path.slice(1).split('/').map(k=>k.replaceAll('~1','/').replaceAll('~0','~'));need(keys.every(k=>!['__proto__','prototype','constructor'].includes(k)),'Unsafe patch');let parent=expected;for(const k of keys.slice(0,-1)){need(Object.hasOwn(parent,k),'Patch parent absent');parent=parent[k];}const k=keys.at(-1);need(Object.hasOwn(parent,k)===(op.op==='replace'),'Patch operation mismatch');parent[k]=op.value;}expected.status='coordinator_validated';const actual={...d};delete actual.coordinatorValidation;need(equal(actual,expected),'Accepted criteria differ from exact designer patch');need(d.coordinatorValidation.originalDesignSha256===hash(original)&&d.coordinatorValidation.repairSha256===hash(patchBytes),'Coordinator source hash mismatch');}
function frozen(ctx){const f=read(safePath(ctx.root,'freeze.json'));for(const[p,digest]of Object.entries(f.hashes))need(hash(fs.readFileSync(path.join(ctx.repo,p)))===digest,`Frozen bytes changed: ${p}`);for(const[p,digest]of Object.entries(f.inputSnapshots))need(hash(fs.readFileSync(safePath(ctx.root,p)))===digest,`Input snapshot changed: ${p}`);const d=read(safePath(ctx.root,'contract.json'));need(hash(fs.readFileSync(safePath(ctx.root,'contract.json')))===f.contractSha256,'Contract changed');validateContract(d);validateDesignerBinding(ctx,d);const journalBytes=fs.readFileSync(safePath(ctx.root,'budget.jsonl'));const prefix=journalBytes.toString('utf8').split(/(?<=\n)/).slice(0,f.journalPrefixEvents).join('');need(hash(Buffer.from(prefix))===f.journalPrefixSha256,'Frozen budget prefix changed');return{d,f};}
export function journalPrefix(bytes,count=null){const lines=bytes.toString('utf8').match(/[^\n]*\n/g)??[];need(lines.join('')===bytes.toString('utf8'),'Journal needs complete newline-terminated records');const events=lines.map(line=>parseRaw(line));replayBudget(events,LIMITS);if(count===null)count=events.length;need(Number.isSafeInteger(count)&&count>0&&count<=events.length,'Invalid journal snapshot length');const prefix=Buffer.from(lines.slice(0,count).join(''));return{bytes:prefix,events:events.slice(0,count),state:replayBudget(events.slice(0,count),LIMITS)};}
function journal(ctx,count=null){return journalPrefix(fs.readFileSync(safePath(ctx.root,'budget.jsonl')),count);}
function append(ctx,event){return appendBudget(ctx.root,'budget.jsonl',LIMITS,event);}
function pending(events){const m=new Map();for(const e of events){if(e.type==='reserve')m.set(e.id,{...e.resources});if(e.type==='cancel'||e.type==='finish')m.delete(e.id);if(e.type==='start')for(const[k,v]of Object.entries(e.consumed??{}))m.get(e.id)[k]-=v;}return m;}
export function reservationEvents(events,d){
  need(!replayBudget(events,LIMITS).started.length,'Active roles before reservation');const p=pending(events),old=p.get('protected-reference-development');need(old?.referenceActions>=27&&old?.referenceWorkerInvocations>=6,'Insufficient unused development allocation');
  const untouched=['protected-estimate-confirmationexclusive','protected-reference-confirmation'];need(p.get(untouched[0])?.estimateInvocations===100&&p.get(untouched[1])?.referenceActions===80&&p.get(untouched[1])?.referenceWorkerInvocations===16,'Protected confirmation reserves changed');
  need(!events.some(e=>e.id==='redesign-reference-development-remainder'),'Schedule already reserved');
  const out=[{type:'cancel',id:'protected-reference-development',note:'Prospective transfer only; cumulative actuals and confirmation unchanged'},{type:'reserve',id:'redesign-reference-development-remainder',resources:{...old,referenceActions:old.referenceActions-27,referenceWorkerInvocations:old.referenceWorkerInvocations-6}},...d.schedule.map(t=>({type:'reserve',id:t.taskId,resources:{referenceActions:t.maxActions,referenceWorkerInvocations:1}}))];
  replayBudget([...events,...out.map((e,i)=>({...e,sequence:events.length+i+1}))],LIMITS);return out;
}
function saveTask(ctx,d,f,spec,slots=null){const prefix=`tasks/${spec.taskId}`,dir=safePath(ctx.root,prefix);const t=taskFor(d,spec,dir,slots);writeOnce(ctx.root,`${prefix}/system.txt`,t.system);writeOnce(ctx.root,`${prefix}/prompt.txt`,t.prompt);writeOnce(ctx.root,`${prefix}/request.json`,{...t.request,contractSha256:f.contractSha256});return t.request;}
function task(ctx,id,f){need(/^(collect|verify)-(hanoi|oaxaca|copenhagen)$/.test(id),'Unknown task');const prefix=`tasks/${id}`,request=read(safePath(ctx.root,`${prefix}/request.json`));need(request.taskId===id&&request.contractSha256===f.contractSha256,'Task binding changed');for(const[k,n]of [['systemSha256','system.txt'],['promptSha256','prompt.txt']])need(hash(fs.readFileSync(safePath(ctx.root,`${prefix}/${n}`)))===request[k],'Prompt bytes changed');return{prefix,request,requestSha256:hash(fs.readFileSync(safePath(ctx.root,`${prefix}/request.json`)))};}

export function run(argv){const[command,id]=argv,ctx=context();
  if(command==='validate'){const d=read(safePath(ctx.root,'contract-input.json'));validateContract(d);validateDesignerBinding(ctx,d);return{valid:true};}
  return lock(ctx,()=>{
  if(command==='freeze'){const bytes=fs.readFileSync(safePath(ctx.root,'contract-input.json')),d=parseRaw(bytes);validateContract(d);validateDesignerBinding(ctx,d);const paths=[...SOURCE_PATHS,'research/city-cost-accuracy/redesign-1/design.json','research/city-cost-accuracy/redesign-1/design-repair.json','research/city-cost-accuracy/redesign-1/contract-input.json','research/city-cost-accuracy/restart-1-prep/budget.jsonl','research/city-cost-accuracy/restart-1-prep/closeout.json','research/city-cost-accuracy/manifest.json'];const hashes={},inputSnapshots={};for(const p of new Set(paths)){safePath(ctx.repo,p);hashes[p]=hash(fs.readFileSync(path.join(ctx.repo,p)));}for(const[p,digest]of Object.entries(d.inputHashes)){safePath(ctx.repo,p);const b=fs.readFileSync(path.join(ctx.repo,p));need(hash(b)===digest,`Designer input changed: ${p}`);const snapshot=`inputs/${p}`;bytesOnce(ctx.root,snapshot,b);inputSnapshots[snapshot]=digest;}const j=journal(ctx);need(!j.state.started.length,'Active design role');const parent=j.events[0];need(hash(fs.readFileSync(path.join(ctx.repo,'research/city-cost-accuracy',parent.parentJournal)))===parent.parentSha256,'Parent journal changed');bytesOnce(ctx.root,'contract.json',bytes);writeOnce(ctx.root,'freeze.json',{schemaVersion:1,contractSha256:hash(bytes),hashes,inputSnapshots,journalPrefixSha256:hash(fs.readFileSync(safePath(ctx.root,'budget.jsonl'))),journalPrefixEvents:j.events.length,parentSha256:parent.parentSha256,gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:ctx.repo,encoding:'utf8'}).trim()});return{frozen:true,contractSha256:hash(bytes)};}
  const{d,f}=frozen(ctx);
  if(command==='prepare'){return d.schedule.filter(t=>t.role==='collect').map(t=>saveTask(ctx,d,f,t).taskId);}
  if(command==='reserve'){const j=journal(ctx),out=reservationEvents(j.events,d);for(const e of out)append(ctx,e);return journal(ctx).state;}
  if(command==='start'){const t=task(ctx,id,f),j=journal(ctx);need(!j.events.some(e=>e.type==='finish'&&e.protocol?.length),'Prior protocol breach halts new acquisition');need(j.state.started.length<d.worker.maxConcurrency,'Concurrency cap');need(j.state.pending.includes(id),'Task not reserved/unstarted');for(const dep of t.request.dependsOn)need(j.events.some(e=>e.id===dep&&e.type==='finish'),'Dependency not terminal');const at=new Date().toISOString(),first=j.events.find(e=>e.type==='start'&&e.id.startsWith('collect-'));if(first)need(Date.parse(at)-Date.parse(first.recordedAt)<=48*3600000,'48 hour window expired');if(t.request.role==='verify'){const collector=j.events.find(e=>e.type==='start'&&e.id===`collect-${t.request.cityId}`);need(Date.parse(at)-Date.parse(collector.recordedAt)<=24*3600000,'Verifier start window expired');}append(ctx,{type:'start',id,consumed:{referenceWorkerInvocations:1},requestSha256:t.requestSha256,model:d.worker.model,effort:d.worker.effort,runtime:d.worker.runtime,deadlineAt:new Date(Date.parse(at)+600000).toISOString()});const entry=journal(ctx).events.at(-1);return{taskId:id,startedAt:entry.recordedAt,deadlineAt:new Date(Date.parse(entry.recordedAt)+600000).toISOString()};}
  if(command==='finish'||command==='finish-missing')return finish(ctx,d,f,id,command==='finish-missing');
  if(command==='cancel-unstarted'){const j=journal(ctx),first=j.events.find(e=>e.type==='start'&&e.id.startsWith('collect-')),halt=j.events.some(e=>e.type==='finish'&&e.protocol?.length)||first&&Date.now()-Date.parse(first.recordedAt)>48*3600000;need(id==='owner-stop'||halt,'Cancellation needs explicit owner stop or protocol/window halt');const ids=d.schedule.map(t=>t.taskId).filter(t=>j.state.pending.includes(t));for(const taskId of ids){append(ctx,{type:'cancel',id:taskId,note:id==='owner-stop'?'Explicit owner stop':'Protocol/window halt'});writeOnce(ctx.root,`tasks/${taskId}/skipped.json`,{taskId,reason:id==='owner-stop'?'Explicit owner stop':'Protocol/window halt'});}return{cancelled:ids};}
  if(command==='prepare-verifiers')return prepareVerifiers(ctx,d,f);
  if(command==='summary')return summarize(ctx,d,f);
  throw Error('Use validate/freeze/prepare/reserve/start/finish/finish-missing/prepare-verifiers/summary/cancel-unstarted');
});}

function capture(ctx,prefix,name){
  const file=safePath(ctx.root,`${prefix}/${name}`);if(!fs.existsSync(file))return null;
  const before=fs.statSync(file),bytes=fs.readFileSync(file),after=fs.statSync(file);bytesOnce(ctx.root,`${prefix}/raw-${name}.bin`,bytes);
  return{bytes,sha256:hash(bytes),mtime:before.mtimeMs,stable:before.mtimeMs===after.mtimeMs&&before.size===after.size};
}
function artifactSlots(frame){return SLOTS.map(slot=>{const all=frame?.slots?.filter?.(v=>v?.slot===slot)??[];return{slot,url:all.length===1&&canonicalUrl(all[0].url)?all[0].url:null};});}
export function replayRecordedTask(raw,request,d,metadata){
  const parsed=parseResponse(raw.response??'',request,d.schemas.response),frameCheck=request.role==='collect'?validateFrame(raw.frame??'',request,d.schemas.frame):null;
  const slots=request.role==='collect'?artifactSlots(frameCheck.frame):request.assignment.slots;
  const trace=validateProvenance(raw.provenance??'',parsed,request,d.schemas.provenance,{spawnAt:metadata.spawnAt,terminalAt:metadata.terminalAt,mtimes:metadata.originalFileMtimes,slots,frame:frameCheck?.frame,firstSpawnAt:metadata.firstSpawnAt});
  if(metadata.captureStable===false){trace.errors.push('Artifact changed during capture');trace.knownActions=null;}
  if(parsed.errors.length)trace.errors.push('Response envelope invalid');
  if(request.role==='collect'&&frameCheck.errors.length)trace.errors.push('Frame envelope/order unauditable');
  const rows=parsed.rows.map(item=>{const result=eligibleRow(item,request,slots.find(v=>v.slot===item.slot),trace);if(parsed.errors.length)result.errors.push('Invalid response envelope');if(frameCheck)result.errors.push(...frameCheck.errors,...frameCheck.slotErrors[item.slot]);result.eligible=!result.errors.length;return result;});
  return{rows,frameCheck,errors:[...parsed.errors,...trace.errors],protocol:trace.protocol,warnings:[...parsed.warnings,...trace.warnings,...(frameCheck?.warnings??[])],knownActions:trace.knownActions};
}
function finish(ctx,d,f,id,missing){
  const{prefix,request,requestSha256}=task(ctx,id,f),j=journal(ctx),start=j.events.find(e=>e.type==='start'&&e.id===id);need(start&&!j.events.some(e=>e.type==='finish'&&e.id===id),'Task not active');
  need(start.requestSha256===requestSha256,'Start/request hash changed');const terminalAt=new Date().toISOString();
  // Raw captures precede all parsing; malformed content remains immutable evidence.
  const response=capture(ctx,prefix,'response.json'),provenance=capture(ctx,prefix,'provenance.json'),frame=request.role==='collect'?capture(ctx,prefix,'frame.json'):null;
  need(missing||response,'Use finish-missing for missing response');
  const parsed=parseResponse(response?.bytes??'',request,d.schemas.response);
  const frameCheck=request.role==='collect'?validateFrame(frame?.bytes??'',request,d.schemas.frame):null;
  const slots=request.role==='collect'?artifactSlots(frameCheck.frame):request.assignment.slots;
  const first=j.events.find(e=>e.type==='start'&&e.id.startsWith('collect-'));
  const trace=validateProvenance(provenance?.bytes??'',parsed,request,d.schemas.provenance,{spawnAt:start.recordedAt,terminalAt,mtimes:{response:response?.mtime,frame:frame?.mtime,provenance:provenance?.mtime},slots,frame:frameCheck?.frame,firstSpawnAt:first?.recordedAt});
  if([response,provenance,frame].some(a=>a&&!a.stable)){trace.errors.push('Artifact changed during capture');trace.knownActions=null;}
  if(parsed.errors.length)trace.errors.push('Response envelope invalid');
  if(request.role==='collect'&&frameCheck.errors.length)trace.errors.push('Frame envelope/order unauditable');
  // Envelope errors make admission missing; full action charge follows unreconciled telemetry.
  const rows=parsed.rows.map(item=>{const result=eligibleRow(item,request,slots.find(v=>v.slot===item.slot),trace);if(parsed.errors.length)result.errors.push('Invalid response envelope');if(frameCheck){result.errors.push(...frameCheck.errors,...frameCheck.slotErrors[item.slot]);}result.eligible=!result.errors.length;return result;});
  const unknown=trace.knownActions===null,charged=unknown?request.maxActions:trace.knownActions;
  const hashes={request:requestSha256,system:request.systemSha256,prompt:request.promptSha256,contract:f.contractSha256,...Object.fromEntries([['response',response],['frame',frame],['provenance',provenance]].filter(([,v])=>v).map(([k,v])=>[k,v.sha256]))};
  const validation={schemaVersion:1,taskId:id,cityId:request.cityId,role:request.role,model:d.worker.model,effort:d.worker.effort,runtime:d.worker.runtime,spawnAt:start.recordedAt,terminalAt,deadlineAt:new Date(Date.parse(start.recordedAt)+600000).toISOString(),hashes,originalFileMtimes:{response:response?.mtime??null,frame:frame?.mtime??null,provenance:provenance?.mtime??null},captureStable:![response,provenance,frame].some(a=>a&&!a.stable),status:!response?'missing':parsed.errors.length||trace.errors.length?'untraceable':'traceable',chargedActions:charged,knownActions:trace.knownActions,unknownActivity:unknown,tokenUsage:null,errors:[...parsed.errors,...trace.errors],protocol:trace.protocol,warnings:[...parsed.warnings,...trace.warnings,...(frameCheck?.warnings??[])],rows,frameCheck,traceabilityLimit:'Worker-recorded evidence, not independently captured native browsing telemetry.'};
  writeOnce(ctx.root,`${prefix}/validation.json`,validation);
  append(ctx,{type:'finish',id,actual:unknown?null:{referenceActions:charged},validationSha256:hash(Buffer.from(json(validation))),responseSha256:response?.sha256??null,protocol:trace.protocol,status:validation.status});
  return{taskId:id,status:validation.status,chargedActions:charged,eligibleSlots:rows.filter(v=>v.eligible).map(v=>v.slot),protocol:trace.protocol};
}
function terminalValidation(ctx,id,j,d,f){const finish=j.events.find(e=>e.id===id&&e.type==='finish');if(!finish)return null;const bytes=fs.readFileSync(safePath(ctx.root,`tasks/${id}/validation.json`));need(digestEqual(hash(bytes),finish.validationSha256),'Validation sidecar changed');const v=parseRaw(bytes),rawArtifacts={};for(const[name,digest]of Object.entries(v.hashes)){if(!['response','frame','provenance'].includes(name))continue;const file=safePath(ctx.root,`tasks/${id}/${name}.json`),original=fs.readFileSync(file),raw=fs.readFileSync(safePath(ctx.root,`tasks/${id}/raw-${name}.json.bin`));need(digestEqual(hash(original),digest)&&digestEqual(hash(raw),digest),`Raw artifact changed: ${id}/${name}`);rawArtifacts[name]=raw;}
  const t=task(ctx,id,f),start=j.events.find(e=>e.type==='start'&&e.id===id),first=j.events.find(e=>e.type==='start'&&e.id.startsWith('collect-'));need(start.requestSha256===t.requestSha256&&v.hashes.request===t.requestSha256&&v.spawnAt===start.recordedAt,'Recorded task/start binding changed');
  const replay=replayRecordedTask(rawArtifacts,t.request,d,{...v,firstSpawnAt:first?.recordedAt});for(const key of ['rows','frameCheck','errors','protocol','warnings','knownActions'])need(equal(replay[key],v[key]),`Recorded validation differs on replay: ${id}/${key}`);need(v.chargedActions===(replay.knownActions??t.request.maxActions),'Recorded charge differs on replay');return v;}
function prepareVerifiers(ctx,d,f){
  const j=journal(ctx);need(d.schedule.filter(t=>t.role==='collect').every(t=>j.events.some(e=>e.id===t.taskId&&e.type==='finish')),'All collectors must be terminal');need(!j.state.started.length,'Active collector');
  const out=[];for(const spec of d.schedule.filter(t=>t.role==='verify')){
    if(j.events.some(e=>e.id===spec.taskId&&['start','finish','cancel'].includes(e.type)))continue;
    const v=terminalValidation(ctx,`collect-${spec.cityId}`,j,d,f),check=v.frameCheck;
    const slots=SLOTS.map(slot=>{const source=check?.frame?.slots?.filter?.(s=>s.slot===slot)??[];return{slot,url:!check?.errors.length&&!check?.slotErrors[slot]?.length&&source.length===1&&canonicalUrl(source[0].url)?source[0].url:null};});
    if(!slots.some(s=>s.url!==null)||j.events.some(e=>e.type==='finish'&&e.protocol?.length)){append(ctx,{type:'cancel',id:spec.taskId,note:'No auditable original source assignment or protocol halt; fixed denominator remains missing'});writeOnce(ctx.root,`tasks/${spec.taskId}/skipped.json`,{taskId:spec.taskId,reason:'No auditable original source assignment or protocol halt',slots});out.push({taskId:spec.taskId,skipped:true});continue;}
    saveTask(ctx,d,f,spec,slots);out.push({taskId:spec.taskId,slots});
  }return out;
}
function summarize(ctx,d,f){
  const saved=fs.existsSync(safePath(ctx.root,'execution-summary.json'))?read(safePath(ctx.root,'execution-summary.json')):null,j=journal(ctx,saved?.budgetEventCount??null);if(saved)need(hash(j.bytes)===saved.budgetPrefixSha256,'Summary budget prefix changed');need(!j.state.started.length,'Live calls cannot be summarized');need(d.schedule.every(t=>j.events.some(e=>e.id===t.taskId&&['finish','cancel'].includes(e.type))),'All scheduled workers must be terminal or explicitly skipped');
  const validations=new Map(d.schedule.map(t=>[t.taskId,terminalValidation(ctx,t.taskId,j,d,f)])),cities=[];let identityDisputes=0;const protocol=[];
  for(const c of d.cities){const a=validations.get(`collect-${c.id}`),b=validations.get(`verify-${c.id}`);protocol.push(...(a?.protocol??[]),...(b?.protocol??[]));
    const pairs=SLOTS.map(slot=>{const left=a?.rows.find(r=>r.slot===slot),right=b?.rows.find(r=>r.slot===slot);if(!left?.eligible||!right?.eligible)return{slot,eligible:false,collector:left??null,verifier:right??null,identityDisputes:[]};const pair=pairRows(left.row,right.row);identityDisputes+=pair.disputes.length?1:0;return{slot,eligible:pair.eligible,collector:left,verifier:right,identityDisputes:pair.disputes,chargeBasisDisagreement:pair.chargeBasisDisagreement};});
    const sourceIndependence={collector:independence((a?.rows??[]).filter(r=>r.eligible).map(r=>r.row)),verifier:independence((b?.rows??[]).filter(r=>r.eligible).map(r=>r.row))};
    const complete=pairs.every(p=>p.eligible)&&sourceIndependence.collector.independent&&sourceIndependence.verifier.independent;
    const metrics=cityMetrics(pairs.map(p=>complete?p.collector.row.listedAmount*p.collector.row.amountScale:null),pairs.map(p=>complete?p.verifier.row.listedAmount*p.verifier.row.amountScale:null));
    const dimensionCounts=Object.fromEntries(['chargeBasis','sizeText','volumeMl','serviceMode','dateBasis','operatorName','menuGroup'].map(k=>[k,Object.fromEntries([...new Set([...(a?.rows??[]),...(b?.rows??[])].map(r=>String(r.row?.[k]??null)))].map(value=>[value,[...(a?.rows??[]),...(b?.rows??[])].filter(r=>String(r.row?.[k]??null)===value).length]))]));
    cities.push({cityId:c.id,currency:c.currency,expectedSlots:4,expectedExtractions:8,eligiblePairs:pairs.filter(p=>p.eligible).length,complete,pairs,sourceIndependence,dimensions:dimensionCounts,metrics,sourceOverlap:{collectorVerifierAssignedUrls:'100% by design',disjointHalvesSlots:0}});
  }
  const outcome=decision(cities.map(c=>c.metrics),{invalidProtocol:protocol.length>0,identityDisputes});
  const taskSummary=d.schedule.map(t=>{const v=validations.get(t.taskId);return{taskId:t.taskId,role:t.role,cityId:t.cityId,status:v?.status??'skipped',spawnAt:v?.spawnAt??null,terminalAt:v?.terminalAt??null,model:d.worker.model,effort:d.worker.effort,runtime:d.worker.runtime,knownActions:v?.knownActions??null,chargedActions:v?.chargedActions??0,unknownActivity:v?.unknownActivity??false,hashes:v?.hashes??null};});
  const summary={schemaVersion:1,experimentId:d.experimentId,contractSha256:f.contractSha256,harnessSha256:f.hashes['scripts/city-cost-accuracy/redesign.mjs'],budgetPrefixSha256:hash(j.bytes),budgetEventCount:j.events.length,budget:j.state,expected:{cities:3,slots:12,rowExtractions:24},observed:{eligibleExtractions:[...validations.values()].reduce((n,v)=>n+(v?.rows.filter(r=>r.eligible).length??0),0),eligiblePairs:cities.reduce((n,c)=>n+c.eligiblePairs,0),independentCompleteCities:cities.filter(c=>c.complete).length},tasks:taskSummary,cities,identityDisputes,protocol,...outcome,limitations:[d.estimand.limits,d.calculations.dimensions,'All provenance action/source metadata is worker-recorded; native browsing is not independently verified.'],reproduction:'node scripts/city-cost-accuracy/redesign.mjs summary'};
  writeOnce(ctx.root,'execution-summary.json',summary);return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(json(run(process.argv.slice(2))));}catch(e){console.error(e.stack);process.exitCode=1;}}
