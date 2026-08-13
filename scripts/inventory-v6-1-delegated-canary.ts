import fs from 'node:fs';
import path from 'node:path';
import { inspectV61Experiment, type V61InventoryRegistration } from '../src/lib/city-cost-v6-1-canary-inventory';

const ROOT = process.cwd();

function optionValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const relativeExperimentDir = optionValue('--experiment-dir')
  ?? 'data/reference/v6/experiments/012-v6-1-corrected-delegated-canary';
const experimentDir = path.resolve(ROOT, relativeExperimentDir);
const registrationPath = path.join(experimentDir, 'registration.json');
const outputPath = path.join(experimentDir, 'collection-inventory.json');
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
const summary = process.argv.includes('--summary');

if (!fs.existsSync(registrationPath)) throw new Error(`Missing registration: ${registrationPath}`);
const registration = JSON.parse(fs.readFileSync(registrationPath, 'utf8')) as V61InventoryRegistration;
const inventory = inspectV61Experiment(registration, experimentDir);
const output = {
  schemaVersion: 'city-cost-v6-1-delegated-canary-inventory-v1',
  ...inventory,
};
const expected = `${JSON.stringify(output, null, 2)}\n`;
const { slots: _slots, ...summaryOutput } = inventory;
const consoleOutput = summary ? summaryOutput : inventory;

if (check) {
  if (fs.existsSync(outputPath) && fs.readFileSync(outputPath, 'utf8') !== expected) throw new Error('Collection inventory is stale.');
  console.log(JSON.stringify({ passed: true, ...consoleOutput, inventoryFile: path.relative(ROOT, outputPath).replaceAll('\\', '/') }, null, 2));
} else {
  if (write) {
    if (fs.existsSync(outputPath)) throw new Error(`Inventory already exists: ${outputPath}; use --check to validate it.`);
    fs.writeFileSync(outputPath, expected);
  }
  console.log(JSON.stringify({ ...consoleOutput, inventoryFile: write ? path.relative(ROOT, outputPath).replaceAll('\\', '/') : null }, null, 2));
}
