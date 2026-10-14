import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,writeOnce} from './core.mjs';
import {run,selectReview,expand} from './restart.mjs';

// Execution repair: retain disputes from invalid records as excluded diagnostics.
// No original record is changed, repaired or admitted to the primary denominator.
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'research/city-cost-accuracy'), target='restart-1-prep';
run(['verify',target]);
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const canonical=value=>JSON.stringify(value,null,2)+'\n';
const design=read(`${target}/contract.json`), frozen=read(`${target}/freeze.json`);
const events=fs.readFileSync(path.join(root,target,'budget.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const ids=[...design.pilotCities.map(id=>`menu-${id}`),...design.feasibility.allocation.hotelCities.map(id=>`hotel-${id}`)];
const rows=[],aggregates=[],disputes=[],sourceResponses={},terminalCollectors=[],excludedDiagnosticIds=[];
for(const id of ids){
  if(!events.some(e=>e.type==='finish'&&e.id===id)) throw Error(`Collector not terminal: ${id}`);
  const prefix=`${target}/tasks/${id}`,sidecar=read(`${prefix}/validation.json`);
  terminalCollectors.push({taskId:id,status:sidecar.status,errors:sidecar.errors});
  const file=path.join(root,prefix,'response.json');
  if(!fs.existsSync(file))continue;
  const raw=fs.readFileSync(file),record=JSON.parse(raw);
  if(hash(raw)!==sidecar.responseSha256)throw Error('Changed response');
  sourceResponses[id]=hash(raw);
  if(sidecar.status==='valid'){
    rows.push(...record.rows);aggregates.push(...record.aggregates);disputes.push(...record.disputes);
  }else if(record.disputes?.length){
    const needed=new Set(record.disputes.map(d=>d.aggregateId).filter(Boolean));
    const diagnosticAggregates=record.aggregates.filter(a=>needed.has(a.aggregateId));
    // Fail closed rather than changing an invalid aggregate's eligibility.
    if(diagnosticAggregates.some(a=>a.provisionalEligibility==='eligible'||a.normalizationStatus==='complete'))throw Error('Invalid record cannot enter primary denominator');
    const rowIds=new Set([...diagnosticAggregates.flatMap(a=>a.constituentAtomicRowIds),...record.disputes.flatMap(d=>d.atomicRowIds)]);
    const diagnosticRows=record.rows.filter(r=>rowIds.has(r.id));
    rows.push(...diagnosticRows);aggregates.push(...diagnosticAggregates);disputes.push(...record.disputes);
    excludedDiagnosticIds.push({taskId:id,aggregateIds:[...needed],rowIds:[...rowIds],reason:'Original invalid record; dispute verification only, never primary reference admission.'});
  }
}
const selected=selectReview(rows,aggregates,disputes,design.reviewSampling);
const ledger={rows,aggregates,disputes,terminalCollectors,sourceResponses,excludedDiagnosticIds,contractSha256:frozen.contractSha256};
const selection={...selected,sourceResponses,excludedDiagnosticIds,contractSha256:frozen.contractSha256,aggregateLedgerSha256:hash(canonical(ledger)),executionRepair:'Preserve genuine disputes in invalid raw records; no primary admission or numerical correction.'};
writeOnce(root,`${target}/aggregate-ledger.json`,ledger);
writeOnce(root,`${target}/review-selection.json`,selection);
const prompt=expand(design.prompts.reviewUserTemplate,{
  FROZEN_SELECTED_PRIMARY_MEAL_AGGREGATES_WITH_ALL_CONSTITUENT_ROWS_AND_ALL_GENUINE_DISPUTES:JSON.stringify(selected,null,2),
  EXACT_DEFINITIONS_OBJECT:JSON.stringify(design.definitions,null,2),EXACT_FEE_NORMALIZATION_OBJECT:JSON.stringify(design.feeNormalization,null,2),
  EXACT_REVIEW_SELECTION_RULE:design.referenceRules.reviewSelection,EXACT_DISPUTE_DEFINITION:design.referenceRules.disputeDefinition});
const system=design.prompts.reviewSystem,prefix=`${target}/tasks/review-feasibility`;
writeOnce(root,`${prefix}/system.txt`,system);writeOnce(root,`${prefix}/prompt.txt`,prompt);
writeOnce(root,`${prefix}/request.json`,{taskId:'review-feasibility',role:'review',...design.workerSelection,maxActions:design.feasibility.allocation.reviewActions,maxInvocations:1,timeoutSeconds:design.resources.hard.workerTimeoutSeconds,schema:design.schemas.reviewRecord,actionSchema:design.schemas.provenance.action,...selected,selectionSha256:hash(canonical(selection)),promptSha256:hash(prompt),systemSha256:hash(system),contractSha256:frozen.contractSha256,referenceDate:frozen.referenceDate,outputProvenance:{taskSha256:'SHA256 exact UTF-8 request.json file bytes',systemSha256:hash(system),userSha256:hash(prompt),protocolSha256:frozen.contractSha256,searchCount:'number of action entries with type search',retrievalCount:'all search/open/click action entries',tokenUsage:'reported object or null when unavailable; never invent',failureReason:'null if none; truthful failure reason otherwise'},promptSourceSha256:frozen.promptSourceSha256,materializerCodeSha256:frozen.materializerCodeSha256,scorerCodeSha256:frozen.scorerCodeSha256});
console.log(JSON.stringify({acceptedAggregates:selected.acceptedAggregates,requiredRows:selected.requiredRowIds.length,disputes:selected.disputes.length,urls:selected.urls.length,excludedDiagnosticIds},null,2));
