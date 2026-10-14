import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, quantile, score, writeOnce } from './core.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (fs.realpathSync(repo).toLowerCase() !== 'c:\\users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend') throw Error('Use the authorized research worktree');
const root = path.join(repo, 'research/city-cost-accuracy');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const manifest = read('manifest.json'), fx = read('fx-freeze.json');
const pilots = manifest.cities.filter(city => city.pilot);
const collection = pilots.map(city => read(`references/${city.id}.json`));
const reviews = fs.readdirSync(path.join(root, 'references')).filter(name => /^review-.*\.json$/.test(name)).sort().map(name => read(`references/${name}`));
const rows = collection.flatMap(file => file.rows.map(row => ({ ...row, cityId: file.cityId })));
for (const review of reviews) {
  for (const change of review.eligibilityOverrides ?? []) {
    const row = rows.find(row => row.cityId === change.cityId && row.id === change.id);
    if (!row) throw Error('Unknown eligibility override');
    Object.assign(row, change);
  }
  rows.push(...(review.supplementaryRows ?? []));
}
const audPerUsd = 1 / fx.observations.rba.USD;
function usdPerUnit(currency) {
  const {rba,ecb,nrb} = fx.observations;
  if (currency === 'USD') return 1;
  if (currency === 'AUD') return rba.USD;
  if (['EUR','JPY','VND'].includes(currency)) return rba.USD / rba[currency];
  if (['DKK','MXN'].includes(currency)) return ecb.USD / ecb[currency];
  if (currency === 'NPR') return 1 / ((nrb.buy + nrb.sell) / 2);
  throw Error(`Missing frozen FX ${currency}`);
}
const offers = new Map();
for (const row of rows.filter(row => row.eligiblePrimary)) {
  if (row.evidenceClass !== 'observed_offer' || !Number.isFinite(row.amount) || row.amount <= 0) throw Error('Unsupported primary evidence');
  const key = `${row.cityId}/${row.measure}`;
  if (!offers.has(key)) offers.set(key, []);
  offers.get(key).push({...row, usd: row.amount * usdPerUnit(row.currency)});
}
const references = [...offers.values()].map(items => ({cityId:items[0].cityId, measure:items[0].measure, category:items[0].category,
  usd:quantile(items.map(item=>item.usd),.5), minUsd:Math.min(...items.map(item=>item.usd)),maxUsd:Math.max(...items.map(item=>item.usd)),
  venues:new Set(items.map(item=>item.venue)).size, observations:items.length, sourceUrls:[...new Set(items.map(item=>item.sourceUrl))],
  rowIds:items.map(item=>item.id), thin:new Set(items.map(item=>item.venue)).size<3}));
const allRuns = [];
for (const city of pilots) for(let repeat=1;repeat<=3;repeat++) {
  const id = `${city.id}-luna-r${repeat}`, dir = `experiments/000-baseline/runs/${id}`;
  const resultPath = path.join(root,dir,'result.json');
  if (!fs.existsSync(resultPath)) throw Error(`Baseline unfinished: ${id}`);
  const req = read(`${dir}/request.json`), result = read(`${dir}/result.json`);
  if (hash(fs.readFileSync(path.join(root,dir,'response.json'))) !== result.responseSha256) throw Error('Response changed after ingest');
  if (hash(fs.readFileSync(path.join(root,dir,'prompt.txt'))) !== req.promptSha256) throw Error('Prompt changed');
  allRuns.push({cityId:city.id, id, ...result});
}
const cells = [], diagnostics = [];
for (const run of allRuns) for(const reference of references.filter(ref=>ref.cityId===run.cityId)) {
  const anchorPrediction = run.diagnosticAnchors?.[reference.measure];
  const derivedPrediction = reference.measure==='ordinary_admission_1p' && run.materialized
    ? run.materialized.tiersUsd.activities_budget/2 : undefined;
  const prediction = anchorPrediction ?? derivedPrediction;
  const cell = {city:run.cityId,category:reference.category,measure:reference.measure,run:run.id,
    reference:reference.usd,prediction:prediction ?? null,valid:run.status==='valid'};
  cells.push(cell);
  diagnostics.push({...cell,valid:Number.isFinite(prediction)});
}
const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
const successful = cells.filter(cell=>cell.valid && Number.isFinite(cell.prediction));
const categories = Object.fromEntries([...new Set(cells.map(cell=>cell.category))].map(category=>[category,
  score(cells.filter(cell=>cell.category===category))]));
const dispersions = pilots.map(city=>{
  const runs=allRuns.filter(run=>run.cityId===city.id&&run.status==='valid');
  return {cityId:city.id,successfulRepeats:runs.length, anchors:Object.fromEntries(
    Object.keys(runs[0]?.materialized.anchorsUsd ?? {}).map(anchor=>{
      const values=runs.map(run=>run.materialized.anchorsUsd[anchor]), center=mean(values);
      return [anchor,{min:Math.min(...values),max:Math.max(...values),mean:center,
        populationCV:values.length>1?Math.sqrt(mean(values.map(value=>(value-center)**2)))/center:null}];
    }))};
});
const collectionActions=collection.reduce((sum,file)=>sum+file.actions.length,0);
const reviewActions=reviews.reduce((sum,file)=>sum+file.actions.length,0);
if (collectionActions!==36||reviewActions!==4) throw Error('Pilot resource accounting mismatch');
const dispatches=fs.readFileSync(path.join(root,'estimation-dispatches.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
const recoveryPath=path.join(root,'artifact-recovery-dispatches.jsonl');
const recoveryCalls=fs.existsSync(recoveryPath)?fs.readFileSync(recoveryPath,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)).reduce((sum,entry)=>sum+entry.calls,0):0;
const perRun=allRuns.map(run=>{
  const provenance=run.provenance;
  const finished=Date.parse(provenance.finishedAt),started=Date.parse(provenance.startedAt);
  const actions=provenance.actions ?? [];
  return {runId:run.id,status:run.status,elapsedSeconds:Number.isFinite(finished)&&Number.isFinite(started)?(finished-started)/1000:null,
    reportedSearches:provenance.searchCount,reportedRetrievals:provenance.retrievalCount,
    recordedActions:actions.length, tokenUsage:provenance.tokenUsage,
    fxDate:run.materialized?.fx.asOfDate ?? null,
    fxLatestObservationVerified:run.materialized ? run.materialized.fx.asOfDate===fx.observations.rba.date &&
      Math.abs(run.materialized.fx.audPerUsd-audPerUsd)<.000001 : false};
});
const reviewedKeys=new Set(reviews.flatMap(review=>(review.reviewedRows??[]).map(row=>`${row.cityId??'oaxaca'}/${row.id}`)));
const originalAccepted=collection.flatMap(file=>file.rows.filter(row=>row.eligiblePrimary).map(row=>`${file.cityId}/${row.id}`));
const result={experiment:'000-baseline',model:'gpt-6-luna',effort:'max',status:'completed',
  interpretation:'Conditional agreement with sparse named-venue offers, not population city prices or total-budget accuracy.',
  referenceCoverage:pilots.map(city=>({cityId:city.id,measures:references.filter(ref=>ref.cityId===city.id).map(ref=>ref.measure),
    datedHotelOffers:0,completeDailyBaskets:0})),references,
  scores:[4,2,10].map(penalty=>score(cells,penalty)),categories,anchorDiagnostics:score(diagnostics),
  successfulOnlyMeanAPE:mean(successful.map(cell=>Math.abs(cell.prediction/cell.reference-1))),
  successfulOnlyMeanAbsoluteAudErrorPerMeasure:mean(successful.map(cell=>Math.abs(cell.prediction-cell.reference)*audPerUsd)),
  successfulOnlyUnderestimateFraction:mean(successful.map(cell=>Number(cell.prediction<cell.reference))),
  repeatDispersion:dispersions,
  independentReview:{originalAcceptedRows:originalAccepted.length, reviewedOriginalAcceptedRows:originalAccepted.filter(key=>reviewedKeys.has(key)).length,
    supplementaryRows:reviews.reduce((sum,review)=>sum+(review.supplementaryRows??[]).length,0),
    note:'Original acceptance count before review overrides; supplementary observations were recorded during review, not independently re-reviewed.'},
  resources:{estimationInvocations:dispatches.length+recoveryCalls, predictionAttempts:dispatches.length, artifactRecoveryCalls:recoveryCalls,
    referenceWorkerInvocations:3, referenceCollectionActions:collectionActions,
    referenceReviewActions:reviewActions, normalizationActions:fx.actions.length, referenceActions:collectionActions+reviewActions+fx.actions.length,
    designPreparationInvocations:1, paidApiCalls:0, unknownTelemetryRuns:perRun.filter(run=>run.reportedSearches===null).length,
    knownReportedSearches:perRun.reduce((sum,run)=>sum+(run.reportedSearches??0),0),perRun},
  cells, hashes:{manifest:hash(fs.readFileSync(path.join(root,'manifest.json'))),fx:hash(fs.readFileSync(path.join(root,'fx-freeze.json')))}};
writeOnce(root,'experiments/000-baseline/summary.json',result);
console.log(JSON.stringify({scores:result.scores,categories,resources:{...result.resources,perRun:undefined},coverage:result.referenceCoverage},null,2));
