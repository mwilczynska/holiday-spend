import {hash} from './core.mjs';

// Applies only source-recorded inputs. Natural-language evidence is checked by the separate verifier.
// Never back-solve an included tax or guess an unspecified fee base/order.
export function normalizeFees(row) {
  const missing=reason=>({normalizationStatus:'missing',normalizationReason:reason,normalizedMeasureAmount:null,normalizedTransactionTotal:null});
  try {
    const positive=value=>Number.isFinite(value)&&value>0;
    const tx=row.transaction;
    if(row.conditionalDiscount===true||row.publicNonMemberRate===false) return missing('Conditional/member quote is outside the public target');
    if(!positive(row.listedAmount)||row.amount!==row.listedAmount||!row.currency) return missing('Missing/contradictory original quote');
    if(!tx||!Number.isInteger(tx.people)||tx.people<1||!Number.isInteger(tx.rooms)||tx.rooms<0||!Number.isInteger(tx.nights)||tx.nights<0||!positive(tx.listedQuantityInTarget)) return missing('Invalid target quantities');
    if(!Array.isArray(tx.items)||!tx.items.every(item=>item.atomicRowId&&positive(item.quantity))) return missing('Missing item quantities');
    if(row.measure==='inexp_meal_1p'&&(tx.people!==1||tx.listedQuantityInTarget!==1||tx.items.length!==1||tx.items[0].quantity!==1)) return missing('Meal target must be one diner ordering one main');
    if(row.measure==='hotel_3star_2p'&&(tx.people!==2||tx.rooms!==1||tx.nights!==3)) return missing('Hotel target must be one room/two adults/three nights');
    if(row.allMandatoryChargesDocumented!==true||!['all_included','explicit_additions'].includes(row.mandatoryChargeStatus)) return missing('Mandatory basis is incomplete');
    if(typeof row.sourceBasisEvidence!=='string'||!row.sourceBasisEvidence.trim()) return missing('Mandatory basis has no source statement');
    if(!Array.isArray(row.charges)) return missing('Missing charge ledger');
    const ids=new Map();
    for(const charge of row.charges){
      if(!charge.id||ids.has(charge.id)) return missing('Duplicate/missing charge identity');
      ids.set(charge.id,charge);
      if(charge.mandatory!==true&&charge.mandatory!==false) return missing('Unknown mandatory status');
      if(charge.mandatory===true&&typeof charge.includedInListedAmount!=='boolean') return missing('Unknown inclusion status');
      if(charge.mandatory===true&&(!Number.isFinite(charge.value)||charge.value<0||!charge.sourceEvidence||!charge.sourceUrl)) return missing('Unsupported mandatory charge');
    }
    const additions=row.charges.filter(c=>c.mandatory===true&&!c.includedInListedAmount);
    if(row.mandatoryChargeStatus==='all_included'&&additions.length) return missing('Contradictory all-included status');
    if(row.mandatoryChargeStatus==='explicit_additions'&&!additions.length) return missing('Explicit-additions status without an addition');
    const principal=row.listedAmount*tx.listedQuantityInTarget;
    const deltas=new Map(),visiting=new Set();
    const compute=id=>{
      if(deltas.has(id)) return deltas.get(id);
      const c=ids.get(id);
      if(!c||!c.mandatory||c.includedInListedAmount) throw Error('Percentage refers to optional/included/absent charge');
      if(visiting.has(id)) throw Error('Cyclic fee basis');
      visiting.add(id);
      let delta;
      if(c.kind==='fixed'){
        if(c.currency!==row.currency||c.valueUnit!=='currency_amount'||!Array.isArray(c.baseRefs)||c.baseRefs.length) throw Error('Invalid fixed charge basis');
        const multipliers={per_person:tx.people,per_bill:1,per_room_night:tx.rooms*tx.nights,per_person_night:tx.people*tx.nights,per_stay:1};
        if(c.applicationUnit==='per_item'){
          if(tx.items.length>1&&!c.appliesToAllItems&&!Array.isArray(c.applicableItemIds)) throw Error('Unclear per-item applicability');
          const items=Array.isArray(c.applicableItemIds)?tx.items.filter(item=>c.applicableItemIds.includes(item.atomicRowId)):tx.items;
          if(!items.length) throw Error('Fee does not apply to known items');
          delta=c.value*items.reduce((sum,item)=>sum+item.quantity,0);
        }else{
          if(!(c.applicationUnit in multipliers)||multipliers[c.applicationUnit]<=0) throw Error('Unclear fixed-charge application');
          delta=c.value*multipliers[c.applicationUnit];
        }
      }else if(c.kind==='percentage'){
        if(c.applicationUnit!=='percentage_base'||!['percent','fraction'].includes(c.valueUnit)||!c.orderEvidence||/^(unknown|unstated)$/i.test(c.orderEvidence)||!Array.isArray(c.baseRefs)||!c.baseRefs.length||new Set(c.baseRefs).size!==c.baseRefs.length) throw Error('Missing percentage base/order');
        const rate=c.valueUnit==='percent'?c.value/100:c.value;
        delta=rate*c.baseRefs.reduce((sum,ref)=>sum+(ref==='principal'?principal:compute(ref)),0);
      }else throw Error('Unknown charge type');
      if(c.rounding!==null&&c.rounding!==undefined){
        const r=c.rounding;
        if(r.stage!=='charge'||!Number.isInteger(r.decimalPlaces)||r.decimalPlaces<0||r.decimalPlaces>10||!['half_up','floor','ceiling'].includes(r.mode)) throw Error('Unsupported source rounding');
        const factor=10**r.decimalPlaces;
        const scaled=delta*factor;
        delta=(r.mode==='half_up'?Math.floor(scaled+.5+Number.EPSILON*Math.max(1,Math.abs(scaled))):({floor:Math.floor,ceiling:Math.ceil}[r.mode])(scaled))/factor;
      }
      if(!Number.isFinite(delta)||delta<0) throw Error('Invalid fee arithmetic');
      visiting.delete(id);deltas.set(id,delta);return delta;
    };
    for(const c of additions) compute(c.id);
    const normalizedTransactionTotal=principal+[...deltas.values()].reduce((sum,delta)=>sum+delta,0);
    const normalizedMeasureAmount=row.measure==='hotel_3star_2p'?normalizedTransactionTotal/3:normalizedTransactionTotal;
    if(!positive(normalizedMeasureAmount)) return missing('Invalid normalized total');
    const result={principal,chargeDeltas:[...deltas].map(([id,amount])=>({id,amount,baseRefs:ids.get(id).baseRefs})),normalizedTransactionTotal,normalizedMeasureAmount,normalizationStatus:'complete',normalizationReason:'Source-recorded mandatory basis applied deterministically; evidence verification remains separate.'};
    return {...result,derivationHash:hash(JSON.stringify({row,result}))};
  }catch(error){return missing(error.message);}
}
