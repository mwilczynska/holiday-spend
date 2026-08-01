#!/usr/bin/env node
/** Deterministic coverage audit for Experiment 051; no modelling or product mapping. */
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '051-minimal-anchor-panel');
const anchors = ['hostel_dorm_bed_1p','hostel_private_room_2p','hotel_3star_room_2p','inexpensive_restaurant_meal_1p','midrange_restaurant_meal_2p','mcmeal_combo','cappuccino_1','domestic_draft_beer_1','paid_attraction_adult_1'];
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json','audit.json'].includes(name)).sort();
const cities=[]; const accepted=Object.fromEntries(anchors.map((a)=>[a,[]])); const rejected=[];
function valid(row){return Boolean(row?.status==='found' && typeof row.value==='number' && Number.isFinite(row.value) && row.value>0 && /^[A-Z]{3}$/.test(row.currency??'') && row.unit && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.referencePeriod && row.searchQuery);}
for(const file of files){const payload=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')); const city=payload.city??file.replace(/\.json$/,''); const flags={}; for(const a of anchors){const ok=valid(payload.anchors?.[a]); flags[a]=ok; if(ok) accepted[a].push({city,value:payload.anchors[a].value,currency:payload.anchors[a].currency,sourceUrl:payload.anchors[a].sourceUrl}); else rejected.push({city,anchor:a,status:payload.anchors?.[a]?.status??'missing',reason:payload.anchors?.[a]?.reason??'strict anchor contract failed'});} cities.push({city,accepted:flags,complete:anchors.every((a)=>flags[a])});}
console.log(JSON.stringify({schemaVersion:'city-cost-v5-minimal-anchor-panel-audit-v1',citiesTested:files.length,anchors,acceptedCells:Object.fromEntries(anchors.map((a)=>[a,accepted[a].length])),completeCities:cities.filter((c)=>c.complete).map((c)=>c.city),cities,accepted,rejected,productMapping:'none_source_boundary_only'},null,2));
