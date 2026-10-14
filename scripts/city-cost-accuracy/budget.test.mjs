import test from 'node:test';
import assert from 'node:assert/strict';
import {replayBudget} from './budget.mjs';
const limits={calls:10,actions:20};
const opening={sequence:1,type:'opening',consumed:{calls:2,actions:3}};
const reserve={sequence:2,type:'reserve',id:'a',resources:{calls:1,actions:8}};
const start={sequence:3,type:'start',id:'a',consumed:{calls:1}};
test('a failed worker consumes its call and unknown action reservation',()=>{
  const state=replayBudget([opening,reserve,start,{sequence:4,type:'finish',id:'a',actual:null}],limits);
  assert.deepEqual(state.used,{calls:3,actions:11});
  assert.deepEqual(state.reserved,{calls:0,actions:0});
});
test('started work cannot be cancelled to release its consumed call',()=>{
  assert.throws(()=>replayBudget([opening,reserve,start,{sequence:4,type:'cancel',id:'a'}],limits));
});
test('reservations protect cumulative caps before dispatch and reject overrun results',()=>{
  assert.throws(()=>replayBudget([opening,{...reserve,resources:{calls:1,actions:18}}],limits));
  assert.throws(()=>replayBudget([opening,reserve,start,{sequence:4,type:'finish',id:'a',actual:{actions:9}}],limits));
});
test('known unused actions release only after completion, duplicate dispatch is rejected',()=>{
  const state=replayBudget([opening,reserve,start,{sequence:4,type:'finish',id:'a',actual:{actions:2}}],limits);
  assert.deepEqual(state.available,{calls:7,actions:15});
  assert.throws(()=>replayBudget([opening,reserve,start,{...start,sequence:4}],limits));
  assert.throws(()=>replayBudget([opening,{...opening,sequence:2}],limits));
});
