import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/081-activity-repeatability");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const tiers = ["budget","mid","high"];
const rows = [];
for (const {city} of inputs.cities) {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const calls = [];
  for (let i = 1; i <= inputs.independentCallsPerCity; i++) {
    const file = path.join(root, `${slug}-call-${i}.json`);
    if (!fs.existsSync(file)) { calls.push({call:i,complete:false,protocolCompliant:false,values:{}}); continue; }
    const p = JSON.parse(fs.readFileSync(file, "utf8"));
    const m = p.measures ?? {};
    const valid = (x, tier) => x?.status === "found" && Number.isFinite(x.value) && x.value > 0 && x.currency === "USD" &&
      x.unit === "per_person_per_day" && x.partyBasis === "one_person" && x.tier === tier && x.scope === "entertainment_or_sightseeing" &&
      x.sourceUrl?.startsWith("http") && !/\/trip-itineraries\//i.test(x.sourceUrl) && x.sourceTitle && x.referencePeriod && x.searchQuery;
    const values = { budget: valid(m.activities_budget_per_person_day,"budget") ? m.activities_budget_per_person_day.value : null,
      mid: valid(m.activities_mid_per_person_day,"mid_range") ? m.activities_mid_per_person_day.value : null,
      high: valid(m.activities_high_per_person_day,"high_end") ? m.activities_high_per_person_day.value : null };
    const t = p.telemetry ?? {};
    calls.push({call:i,complete:Object.values(values).every((v)=>v !== null),protocolCompliant:p.schemaVersion === "city-cost-v5-activity-repeatability-v1" && t.searchesAttempted === 2 && t.searchOperations === 2 && t.directReads === 0 && t.retries === 0 && t.fallbackSources === 0 && t.arithmeticOperations === 0 && t.currencyConversions === 0 && t.crossCityEvidence === 0 && t.protocolCompliant !== false,values});
  }
  const stats = {};
  for (const tier of tiers) { const values = calls.map((c)=>c.values[tier]).filter((v)=>Number.isFinite(v)); const sorted=[...values].sort((a,b)=>a-b); const median=sorted.length ? sorted[Math.floor(sorted.length/2)] : null; stats[tier]={n:values.length,values,relativeRangePercent:median ? (Math.max(...values)-Math.min(...values))/median*100 : null}; }
  rows.push({city,calls,stats,threeComplete:calls.filter((c)=>c.complete).length === 3});
}
const allStats = Object.fromEntries(tiers.map((tier)=>{const values=rows.map((r)=>r.stats[tier].relativeRangePercent).filter(Number.isFinite).sort((a,b)=>a-b);return [tier,{medianRelativeRangePercent:values.length?values[Math.floor(values.length/2)]:null,values}]}));
const result={schemaVersion:"city-cost-v5-activity-repeatability-audit-v1",citiesTested:rows.length,callsTested:rows.reduce((n,r)=>n+r.calls.length,0),protocolCompliant:rows.reduce((n,r)=>n+r.calls.filter(c=>c.protocolCompliant).length,0),citiesWithThreeCompleteCalls:rows.filter(r=>r.threeComplete).length,relativeRangeByTier:allStats,repeatabilityGate:"15 compliant calls, 5 cities with 3 complete calls, median relative range <=25% per tier",repeatabilityGatePassed:rows.every(r=>r.threeComplete)&&rows.reduce((n,r)=>n+r.calls.filter(c=>c.protocolCompliant).length,0)>=15&&tiers.every(t=>allStats[t].medianRelativeRangePercent !== null&&allStats[t].medianRelativeRangePercent<=25),productMapping:"none_repeatability_only",rows};
fs.writeFileSync(path.join(root,"results.json"),`${JSON.stringify(result,null,2)}\n`);fs.writeFileSync(path.join(root,"audit.json"),`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result,null,2));
