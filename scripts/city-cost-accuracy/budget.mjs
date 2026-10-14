import fs from 'node:fs';
import { safePath } from './core.mjs';

// Sequential coordinator-only journal. Reserving an allocation is not an executed call.
// A started worker consumes its call even if it never returns; unknown actions retain their reservation.
export function replayBudget(events, limits) {
  const used = Object.fromEntries(Object.keys(limits).map(key => [key, 0]));
  const reservations = new Map(), started = new Set(), finished = new Set();
  const add = (target, delta) => {
    for (const [key, value] of Object.entries(delta)) {
      if (!(key in limits) || !Number.isInteger(value) || value < 0) throw Error('Invalid resource amount');
      target[key] = (target[key] ?? 0) + value;
    }
  };
  let prior = 0;
  for (const event of events) {
    if (event.sequence !== ++prior) throw Error('Nonsequential journal');
    if (event.type === 'opening') {
      if (event.sequence !== 1) throw Error('Only one opening balance is allowed');
      add(used, event.consumed);
    } else if (event.type === 'reserve') {
      if (!event.id || reservations.has(event.id) || started.has(event.id) || finished.has(event.id)) throw Error('Duplicate reservation');
      const reserved = {};
      add(reserved, event.resources);
      reservations.set(event.id, reserved);
    } else if (event.type === 'start') {
      const reserved = reservations.get(event.id);
      if (!reserved || started.has(event.id) || finished.has(event.id)) throw Error('Unreserved or duplicate start');
      const consumed = event.consumed ?? {};
      for (const [key,value] of Object.entries(consumed)) if (value > (reserved[key] ?? 0)) throw Error('Start exceeded reservation');
      add(used, consumed);
      for (const [key,value] of Object.entries(consumed)) reserved[key] -= value;
      started.add(event.id);
    } else if (event.type === 'finish') {
      const reserved = reservations.get(event.id);
      if (!reserved || !started.has(event.id) || finished.has(event.id)) throw Error('Unstarted or duplicate finish');
      if (event.actual === null) {
        // Calls already charged by start; charge all remaining unknown actions to avoid a free failed worker.
        add(used, reserved);
      } else {
        for (const [key,value] of Object.entries(event.actual ?? {})) if (value > (reserved[key] ?? 0)) throw Error('Actual usage exceeded reservation');
        add(used, event.actual ?? {});
      }
      reservations.delete(event.id);
      finished.add(event.id);
    } else if (event.type === 'cancel') {
      if (!reservations.has(event.id) || started.has(event.id)) throw Error('Started work cannot be cancelled for free');
      reservations.delete(event.id);
      finished.add(event.id);
    } else { throw Error('Unknown journal event'); }
    const committed = {...used};
    for (const reserved of reservations.values()) add(committed, reserved);
    for (const [key,value] of Object.entries(committed)) if(value > limits[key]) throw Error(`Resource cap exceeded: ${key}`);
  }
  const reserved = Object.fromEntries(Object.keys(limits).map(key => [key, 0]));
  for (const allocation of reservations.values()) add(reserved, allocation);
  return {used, reserved, available:Object.fromEntries(Object.keys(limits).map(key=>[key,limits[key]-used[key]-reserved[key]])),
    started:[...started].filter(id=>!finished.has(id)), pending:[...reservations.keys()].filter(id=>!started.has(id))};
}

export function appendBudget(root, relative, limits, event) {
  const target = safePath(root,relative);
  const events = fs.existsSync(target) ? fs.readFileSync(target,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)) : [];
  const entry = {...event, sequence:events.length+1, recordedAt:new Date().toISOString()};
  const state = replayBudget([...events,entry],limits);
  fs.appendFileSync(target,JSON.stringify(entry)+'\n');
  return state;
}
