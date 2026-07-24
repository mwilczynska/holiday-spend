import fs from 'node:fs';
import path from 'node:path';
import { cityCostObservationSchema, type CityCostObservation } from '../src/lib/city-cost-observation';
import {
  buildCityCostV3Dataset,
  cityCostFxSnapshotSchema,
  type CityCostFxSnapshot,
} from '../src/lib/city-cost-methodology-v3';
import { getCountryCurrencyCode } from '../src/lib/country-metadata';

const DEFAULT_OBSERVATIONS = 'data/reference/observations';
const DEFAULT_FX = 'data/reference/fx/city_cost_fx_aud_2026-07-22.json';
const DEFAULT_OUTPUT = 'data/reference/materialized/city_costs_v3_alpha.json';

function optionValue(name: string, fallback: string) {
  const equalsArgument = process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`));
  if (equalsArgument) return equalsArgument.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`);
    return value;
  }
  return fallback;
}

function relativePath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll('\\', '/');
}

function observationFiles(inputPath: string) {
  const resolved = path.resolve(process.cwd(), inputPath);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(resolved)
      .filter((name) => name.endsWith('.jsonl'))
      .sort()
      .map((name) => path.join(resolved, name));
  }
  if (!resolved.endsWith('.jsonl')) throw new Error(`Observation input must be JSONL: ${inputPath}`);
  return [resolved];
}

function readObservations(files: string[]) {
  const observations: CityCostObservation[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const location = `${relativePath(file)}:${index + 1}`;
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch (error) {
        throw new Error(`${location}: invalid JSON (${error instanceof Error ? error.message : 'unknown error'})`);
      }
      const parsed = cityCostObservationSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
          .join('; ');
        throw new Error(`${location}: ${issues}`);
      }
      observations.push(parsed.data);
    }
  }
  return observations;
}

function readFxSnapshot(filePath: string): CityCostFxSnapshot {
  const resolved = path.resolve(process.cwd(), filePath);
  const parsedJson = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  const parsed = cityCostFxSnapshotSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
      .join('; ');
    throw new Error(`${relativePath(resolved)}: ${issues}`);
  }
  return parsed.data;
}

function run() {
  const shouldWrite = process.argv.includes('--write');
  const shouldCheck = process.argv.includes('--check');
  if (shouldWrite && shouldCheck) throw new Error('Choose either --write or --check, not both');

  const observationInput = optionValue('--observations', DEFAULT_OBSERVATIONS);
  const fxInput = optionValue('--fx', DEFAULT_FX);
  const outputInput = optionValue('--output', DEFAULT_OUTPUT);
  const files = observationFiles(observationInput);
  if (!files.length) throw new Error(`No JSONL observation files found in ${observationInput}`);

  const observations = readObservations(files);
  const snapshot = readFxSnapshot(fxInput);
  const dataset = buildCityCostV3Dataset(
    observations,
    snapshot,
    (_city, country) => getCountryCurrencyCode(country)
  );
  const artifact = {
    ...dataset,
    inputs: {
      observationFiles: files.map(relativePath),
      fxSnapshotFile: relativePath(path.resolve(process.cwd(), fxInput)),
    },
  };
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  const outputPath = path.resolve(process.cwd(), outputInput);

  if (shouldCheck) {
    if (!fs.existsSync(outputPath)) throw new Error(`Missing generated output ${relativePath(outputPath)}`);
    if (fs.readFileSync(outputPath, 'utf8') !== serialized) {
      throw new Error(`${relativePath(outputPath)} is stale; run npm run methodology:materialize:v3`);
    }
  } else if (shouldWrite) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        valid: true,
        mode: shouldCheck ? 'check' : shouldWrite ? 'write' : 'preview',
        output: relativePath(outputPath),
        calculatorVersion: dataset.calculatorVersion,
        fxSnapshotId: dataset.fxSnapshotId,
        observations: dataset.observationSummary,
        cities: dataset.cityCount,
        completeCities: dataset.completeCityCount,
        materializedTierCells: dataset.materializedTierCells,
        requiredTierCells: dataset.requiredTierCells,
        tierCoverage: dataset.tierCoverage,
        qualitySummary: dataset.qualitySummary,
      },
      null,
      2
    )
  );
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
