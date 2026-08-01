import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/084-nomadlio-food-drink");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const names = ["inexpensive_meal", "mid_range_meal", "coffee", "beer", "cocktail", "wine_bottle"];
const rows = [];
for (const {city,slug} of inputs.cities) {
  const file = path.join(root, `${slug}.json`);
  if (!fs.existsSync(file)) { rows.push({city,complete:false,protocolCompliant:false,found:0,observed:0,proxies:0}); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8")); const m=p.measures??{}; const t=p.telemetry??{};
  const valid=x=>x?.status==="found"&&Number.isFinite(x.value)&&x.value>0&&x.currency==="USD"&&x.sourceUrl?.startsWith("http")&&x.sourceTitle&&x.pageUpdatedAt&&x.label&&x.evidenceText;
  const observed=x=>valid(x)&&x.definitionStatus==="definition_compatible";
  const found=names.filter(n=>valid(m[n])).length; const obs=names.filter(n=>observed(m[n])).length;
  rows.push({city,complete:found===names.length,found,observed:obs,proxies:found-obs,protocolCompliant:p.schemaVersion==="city-cost-v5-nomadlio-food-drink-v1"&&t.searchesAttempted===1&&t.searchOperations===1&&t.directReads===1&&t.retries===0&&t.fallbackSources===0&&t.arithmeticOperations===0&&t.currencyConversions===0&&t.crossCityEvidence===0&&t.protocolCompliant!==false});
}
const result={schemaVersion:"city-cost-v5-nomadlio-food-drink-audit-v1",citiesTested:rows.length,completeCities:rows.filter(r=>r.complete).length,foundCells:rows.reduce((s,r)=>s+r.found,0),observedCells:rows.reduce((s,r)=>s+r.observed,0),proxyCells:rows.reduce((s,r)=>s+r.proxies,0),protocolCompliant:rows.filter(r=>r.protocolCompliant).length,screenGate:"completeCities>=10 and protocolCompliant>=10",screenGatePassed:rows.filter(r=>r.complete).length>=10&&rows.filter(r=>r.protocolCompliant).length>=10,productMapping:"none_proxy_screen_only",rows};
fs.writeFileSync(path.join(root,"results.json"),`${JSON.stringify(result,null,2)}\n`); fs.writeFileSync(path.join(root,"audit.json"),`${JSON.stringify(result,null,2)}\n`); console.log(JSON.stringify(result,null,2));
