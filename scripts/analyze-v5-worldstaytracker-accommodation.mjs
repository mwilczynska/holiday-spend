import fs from "node:fs";
import path from "node:path";

const root = path.resolve("data/reference/v5/experiments/082-worldstaytracker-accommodation");
const inputs = JSON.parse(fs.readFileSync(path.join(root, "inputs.json"), "utf8"));
const rows = [];
for (const {city} of inputs.cities) {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = path.join(root, `${slug}.json`);
  if (!fs.existsSync(file)) { rows.push({city,complete:false,protocolCompliant:false,accepted:{three:false,four:false}}); continue; }
  const p = JSON.parse(fs.readFileSync(file, "utf8")); const m=p.measures??{}; const t=p.telemetry??{};
  const strict=(x,n)=>x?.status==="found"&&Number.isFinite(x.value)&&x.value>0&&x.currency==="USD"&&x.unit==="per_room_per_night"&&x.class===`${n}_star`&&x.occupancyBasis==="explicit_two_adults_source_average"&&x.statistic==="city_average"&&x.sourceUrl?.startsWith("http")&&x.sourceTitle&&x.referencePeriod&&x.searchQuery&&x.checkInDate&&x.advancePeriod&&Number.isInteger(x.propertyCount)&&x.propertyCount>0&&x.breakfastIncluded===true&&x.reviewScoreMinimum===7&&!/\b(?:from|starting|lowest|nearby|regional)\b/i.test(`${x.evidenceText??""}`);
  const accepted={three:strict(m.hotel_3star_room_2p,3),four:strict(m.hotel_4star_room_2p,4)};
  rows.push({city,complete:accepted.three&&accepted.four,accepted,protocolCompliant:p.schemaVersion==="city-cost-v5-worldstaytracker-accommodation-v1"&&t.searchesAttempted===2&&t.searchOperations===2&&t.directReads===2&&t.retries===0&&t.fallbackSources===0&&t.arithmeticOperations===0&&t.currencyConversions===0&&t.crossCityEvidence===0&&t.protocolCompliant!==false});
}
const result={schemaVersion:"city-cost-v5-worldstaytracker-accommodation-audit-v1",citiesTested:rows.length,completeCities:rows.filter(r=>r.complete).length,threeStarCoverage:rows.filter(r=>r.accepted.three).length,fourStarCoverage:rows.filter(r=>r.accepted.four).length,protocolCompliant:rows.filter(r=>r.protocolCompliant).length,screenGate:"completeCities>=10 and protocolCompliant>=10",screenGatePassed:rows.filter(r=>r.complete).length>=10&&rows.filter(r=>r.protocolCompliant).length>=10,semanticBasis:"2 adults / 1 night / breakfast included / review score >=7 / 15-day advance",productMapping:"none_semantic_screen_only",rows};
fs.writeFileSync(path.join(root,"results.json"),`${JSON.stringify(result,null,2)}\n`);fs.writeFileSync(path.join(root,"audit.json"),`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result,null,2));
