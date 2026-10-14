import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hash, writeOnce, safePath, checkHash, score, pairedCityBootstrap, requireConfirmationFreeze } from './core.mjs';

test('output confinement, immutable records, and prompt changes fail closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'city-accuracy-'));
  try {
    assert.throws(() => safePath(dir, '../travel.db'));
    assert.throws(() => safePath(dir, path.resolve(dir, 'travel.db')));
    writeOnce(dir, 'run/prompt.txt', 'original');
    writeOnce(dir, 'run/prompt.txt', 'original');
    assert.throws(() => writeOnce(dir, 'run/prompt.txt', 'changed'));
    assert.throws(() => checkHash('changed', hash('original')));
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('confirmation cannot be prepared before a finalist freeze', () => {
  assert.throws(() => requireConfirmationFreeze({split:'confirmation'}, false));
  requireConfirmationFreeze({split:'development'}, false);
});
test('failed predictions retain denominator and repeated cities have equal macro weight', () => {
  const cell = (city, run, prediction) => ({city, category:'food', measure:'meal', run, prediction, reference:10});
  const result = score([cell('a','1',10),cell('a','2',10),cell('a','3',10),cell('b','1',null)]);
  assert.equal(result.expectedCells, 4);
  assert.equal(result.failedCells, 1);
  assert.equal(result.primaryLoss, Math.log(4)/2);
  assert.equal(result.successfulOnlyMedianAPE, 0);
  assert.throws(() => score([{...cell('a','1',10),reference:0}]));
  assert.throws(() => score([cell('a','1',10),cell('a','1',20)]));
});
test('bootstrap pairs cities, rejects differing coverage, and is reproducible', () => {
  const a = {hanoi:.5,bled:.6,kyoto:.7}, b = {hanoi:.4,bled:.4,kyoto:.4};
  assert.deepEqual(pairedCityBootstrap(a,b,1000), pairedCityBootstrap(a,b,1000));
  assert.ok(pairedCityBootstrap(a,b,1000).lower95 > 0);
  assert.throws(() => pairedCityBootstrap(a,{hanoi:.4,bled:.4},1000));
});
test('category weighting and app-invalid positive anchors do not inflate successful coverage', () => {
  const cell = (category,measure,prediction,valid=true) => ({city:'a',category,measure,run:'1',prediction,reference:10,valid});
  const result=score([cell('drinks','coffee',10),cell('drinks','beer',10),cell('food','meal',10,false)]);
  assert.equal(result.primaryLoss,Math.log(4)/2);
  assert.equal(result.failedCells,1);
});
