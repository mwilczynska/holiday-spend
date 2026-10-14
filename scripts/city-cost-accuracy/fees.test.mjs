import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFees} from './fees.mjs';
// Synthetic fixtures only; these amounts are unrelated to any target city.
const row=(charges=[],extras={})=>({amount:100,listedAmount:100,currency:'XXX',measure:'inexp_meal_1p',transaction:{people:1,rooms:0,nights:0,items:[{atomicRowId:'fixture/1',quantity:1}],listedQuantityInTarget:1},mandatoryChargeStatus:charges.some(c=>c.mandatory&&!c.includedInListedAmount)?'explicit_additions':'all_included',sourceBasisEvidence:'Synthetic explicit complete mandatory basis',allMandatoryChargesDocumented:true,charges,...extras});
const fixed=(id,value,applicationUnit='per_bill',extras={})=>({id,value,applicationUnit,kind:'fixed',valueUnit:'currency_amount',currency:'XXX',mandatory:true,includedInListedAmount:false,baseRefs:[],sourceUrl:'https://fixture.invalid/menu',sourceEvidence:'Synthetic explicit charge basis',orderEvidence:null,rounding:null,...extras});
const percent=(id,value,baseRefs=['principal'],extras={})=>({...fixed(id,value,'percentage_base'),kind:'percentage',valueUnit:'percent',baseRefs,orderEvidence:'Synthetic explicit base statement',...extras});
test('included charges are not extracted or added twice',()=>{
  assert.equal(normalizeFees(row()).normalizedMeasureAmount,100);
  assert.equal(normalizeFees(row([fixed('included',10,'per_bill',{includedInListedAmount:true})])).normalizedMeasureAmount,100);
});
test('fixed, percent, additive and explicitly compounded charges',()=>{
  assert.equal(normalizeFees(row([fixed('fee',5)])).normalizedMeasureAmount,105);
  assert.equal(normalizeFees(row([percent('tax',10)])).normalizedMeasureAmount,110);
  assert.equal(normalizeFees(row([percent('service',5),percent('tax',10)])).normalizedMeasureAmount,115);
  assert.equal(normalizeFees(row([percent('service',5),percent('tax',10,['principal','service'])])).normalizedMeasureAmount,115.5);
  assert.equal(normalizeFees(row([fixed('fee',5),percent('tax',10,['principal','fee'])])).normalizedMeasureAmount,115.5);
});
test('unknown order, included-base extraction and cycles stay missing',()=>{
  assert.equal(normalizeFees(row([percent('tax',10,['principal'],{orderEvidence:null})])).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([fixed('included',10,'per_bill',{includedInListedAmount:true}),percent('tax',10,['principal','included'])])).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([percent('a',10,['b']),percent('b',10,['a'])])).normalizationStatus,'missing');
});
test('optional charges are excluded; contradictory or incomplete basis is not repaired',()=>{
  assert.equal(normalizeFees(row([fixed('tip',10,'per_bill',{mandatory:false})])).normalizedMeasureAmount,100);
  assert.equal(normalizeFees(row([fixed('fee',5)],{mandatoryChargeStatus:'all_included'})).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([],{allMandatoryChargesDocumented:false})).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([],{sourceBasisEvidence:null})).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([fixed('fee',5,'per_bill',{mandatory:null})])).normalizationStatus,'missing');
});
test('hotel occupancy multipliers are applied to full stay before nightly division',()=>{
  const hotel=row([fixed('city-tax',5,'per_person_night'),fixed('booking-fee',3,'per_stay')],{measure:'hotel_3star_2p',transaction:{people:2,rooms:1,nights:3,items:[],listedQuantityInTarget:3}});
  assert.equal(normalizeFees(hotel).normalizedTransactionTotal,333);
  assert.equal(normalizeFees(hotel).normalizedMeasureAmount,111);
});
test('unsupported currency and application cannot masquerade as complete normalization',()=>{
  assert.equal(normalizeFees(row([fixed('fee',5,'per_bill',{currency:'YYY'})])).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([fixed('fee',5,'per_room_night')])).normalizationStatus,'missing');
});
test('explicit per-person/room-night fees, charge rounding and conditional prices',()=>{
  const hotel=row([fixed('person',5,'per_person'),fixed('room-night',2,'per_room_night')],{measure:'hotel_3star_2p',transaction:{people:2,rooms:1,nights:3,items:[],listedQuantityInTarget:3}});
  assert.equal(normalizeFees(hotel).normalizedTransactionTotal,316);
  const rounded=percent('tax',1.005,['principal'],{rounding:{stage:'charge',decimalPlaces:2,mode:'half_up'}});
  assert.equal(normalizeFees(row([rounded])).normalizedMeasureAmount,101.01);
  assert.equal(normalizeFees(row([],{conditionalDiscount:true})).normalizationStatus,'missing');
  assert.equal(normalizeFees(row([],{publicNonMemberRate:false})).normalizationStatus,'missing');
});
