import fs from 'node:fs';
import path from 'node:path';
import {
  cityCostObservationSchema,
  summarizeObservationCoverage,
  type CityCostObservation,
} from '../src/lib/city-cost-observation';

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error('Usage: npm run methodology:observations:validate -- <observations.jsonl|directory> [...]');
  process.exit(1);
}

const inputPaths = inputs.flatMap((input) => {
  const inputPath = path.resolve(process.cwd(), input);
  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(inputPath)
      .filter((name) => name.endsWith('.jsonl'))
      .sort()
      .map((name) => path.join(inputPath, name));
  }
  return [inputPath];
});

if (!inputPaths.length) {
  console.error('No JSONL observation files found.');
  process.exit(1);
}

const observations: CityCostObservation[] = [];
const observationIds = new Set<string>();
const errors: string[] = [];

for (const inputPath of inputPaths) {
  const inputLabel = path.relative(process.cwd(), inputPath).replaceAll('\\', '/');
  const lines = fs
    .readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const location = `${inputLabel}:${index + 1}`;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      errors.push(`${location}: invalid JSON (${error instanceof Error ? error.message : 'unknown error'})`);
      continue;
    }

    const parsed = cityCostObservationSchema.safeParse(value);
    if (!parsed.success) {
      errors.push(
        `${location}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
          .join('; ')}`
      );
      continue;
    }

    if (observationIds.has(parsed.data.observationId)) {
      errors.push(`${location}: duplicate observationId ${parsed.data.observationId}`);
      continue;
    }

    observationIds.add(parsed.data.observationId);
    observations.push(parsed.data);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      inputs: inputPaths.map((inputPath) => path.relative(process.cwd(), inputPath).replaceAll('\\', '/')),
      valid: true,
      records: observations.length,
      coverage: summarizeObservationCoverage(observations),
    },
    null,
    2
  )
);
