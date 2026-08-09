import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const validator = path.join(root, 'scripts/validate-city-cost-v6-ground-truth.mjs');
const oldLedger = 'a80e922:data/reference/v6/ground-truth/development-ledger.json';
let output = '';
let validatorExitCode = 0;

try {
  output = execFileSync(process.execPath, [validator, `--ledger-git=${oldLedger}`], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  validatorExitCode = error.status ?? 1;
  output = String(error.stdout ?? '');
}

const report = JSON.parse(output);
const regressionCities = ['Hanoi', 'Phuket', 'Da Nang'];
const requiredWarnings = regressionCities.flatMap((city) => [
  `Intra-city accommodation class inversion: ${city}`,
  `Sub-amount AUD figure in evidence: ${city}/`,
  `Accommodation ratio outside fitted band: ${city}/`,
]);
const missingWarnings = requiredWarnings.filter((expected) => !report.warnings.some((warning) => warning.startsWith(expected)));

if (missingWarnings.length) {
  throw new Error(`Legacy warning regression failed; missing: ${missingWarnings.join('; ')}`);
}

console.log(JSON.stringify({
  passed: true,
  replay: oldLedger,
  validatorExitCode,
  expectedLegacyContractErrors: report.errors.length > 0,
  warningFamiliesConfirmed: regressionCities.map((city) => ({
    city,
    inversion: report.warnings.some((warning) => warning === `Intra-city accommodation class inversion: ${city}`),
    subAmountAud: report.warnings.some((warning) => warning.startsWith(`Sub-amount AUD figure in evidence: ${city}/`)),
    ratioBand: report.warnings.some((warning) => warning.startsWith(`Accommodation ratio outside fitted band: ${city}/`)),
  })),
}, null, 2));
