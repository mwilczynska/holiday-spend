import fs from 'node:fs';
import path from 'node:path';
import {
  cityCostCollectionManifestSchema,
  cityCostCollectionReportSchema,
} from '../src/lib/city-cost-collection-batch';
import {
  CITY_COST_MEASURES,
  cityCostObservationSchema,
  type CityCostObservation,
} from '../src/lib/city-cost-observation';

const input = process.argv[2] ?? 'data/reference/city_cost_collection_batches.json';
const inputPath = path.resolve(process.cwd(), input);
const errors: string[] = [];

let rawManifest: unknown;
try {
  rawManifest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  console.error(`Could not read manifest: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}

const parsedManifest = cityCostCollectionManifestSchema.safeParse(rawManifest);
if (!parsedManifest.success) {
  console.error(
    parsedManifest.error.issues
      .map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
      .join('\n')
  );
  process.exit(1);
}

const manifest = parsedManifest.data;
const referencedObservationFiles = new Set<string>();
const observationIds = new Set<string>();
let observationCount = 0;
let acceptedObservationCount = 0;

function relativeLabel(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll('\\', '/');
}

function requestedCategory(observation: CityCostObservation) {
  if (observation.category === 'food' || observation.category === 'drinks') return 'food_drinks';
  return observation.category;
}

for (const batch of manifest.batches) {
  const allowedCities = new Map<string, Set<string>>(
    batch.cities.map((city) => [`${city.city}|${city.country}`, new Set<string>(city.categories)] as const)
  );
  let batchAcceptedCount = 0;
  let batchRejectedCount = 0;
  const batchCoverage = new Map<CityCostObservation['measure'], number>();

  for (const relativeObservationFile of batch.observationFiles) {
    const observationPath = path.resolve(process.cwd(), relativeObservationFile);
    const observationLabel = relativeLabel(observationPath);
    referencedObservationFiles.add(observationLabel);

    if (!fs.existsSync(observationPath)) {
      errors.push(`${batch.batchId}: observation file does not exist: ${observationLabel}`);
      continue;
    }

    const lines = fs
      .readFileSync(observationPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const location = `${observationLabel}:${index + 1}`;
      let value: unknown;
      try {
        value = JSON.parse(lines[index]);
      } catch (error) {
        errors.push(`${location}: invalid JSON (${error instanceof Error ? error.message : 'unknown error'})`);
        continue;
      }

      const parsedObservation = cityCostObservationSchema.safeParse(value);
      if (!parsedObservation.success) {
        errors.push(
          `${location}: ${parsedObservation.error.issues
            .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
            .join('; ')}`
        );
        continue;
      }

      const observation = parsedObservation.data;
      observationCount += 1;

      if (observationIds.has(observation.observationId)) {
        errors.push(`${location}: duplicate observationId ${observation.observationId}`);
      }
      observationIds.add(observation.observationId);

      if (observation.batchId !== batch.batchId) {
        errors.push(`${location}: batchId ${observation.batchId} does not match manifest batch ${batch.batchId}`);
      }

      const cityKey = `${observation.city}|${observation.country}`;
      const categories = allowedCities.get(cityKey);
      if (!categories) {
        errors.push(`${location}: city ${cityKey} is not declared in batch ${batch.batchId}`);
      } else if (!categories.has(requestedCategory(observation))) {
        errors.push(`${location}: category ${requestedCategory(observation)} is not requested for ${cityKey}`);
      }

      if (observation.reviewerStatus === 'accepted') {
        acceptedObservationCount += 1;
        batchAcceptedCount += 1;
        batchCoverage.set(observation.measure, (batchCoverage.get(observation.measure) ?? 0) + 1);
      } else if (observation.reviewerStatus === 'rejected') {
        batchRejectedCount += 1;
      }
    }
  }

  if (batchAcceptedCount !== batch.acceptedObservations) {
    errors.push(
      `${batch.batchId}: manifest reports ${batch.acceptedObservations} accepted observations but files contain ${batchAcceptedCount}`
    );
  }

  if (batch.reportFile) {
    const reportPath = path.resolve(process.cwd(), batch.reportFile);
    if (!fs.existsSync(reportPath)) {
      errors.push(`${batch.batchId}: report file does not exist: ${relativeLabel(reportPath)}`);
    } else {
      try {
        const parsedReport = cityCostCollectionReportSchema.safeParse(
          JSON.parse(fs.readFileSync(reportPath, 'utf8'))
        );
        if (!parsedReport.success) {
          errors.push(
            `${batch.batchId}: invalid report (${parsedReport.error.issues
              .map((issue) => `${issue.path.join('.') || 'report'}: ${issue.message}`)
              .join('; ')})`
          );
          continue;
        }
        const report = parsedReport.data;
        if (report.batchId !== batch.batchId) {
          errors.push(`${batch.batchId}: report batchId does not match manifest`);
        }
        if (report.checkpoint !== batch.checkpoint) {
          errors.push(`${batch.batchId}: report checkpoint does not match manifest`);
        }
        if (report.completedCityCategoryCalls !== batch.completedCalls) {
          errors.push(`${batch.batchId}: report completed calls do not match manifest`);
        }
        if (report.acceptedObservations !== batchAcceptedCount) {
          errors.push(`${batch.batchId}: report accepted observations do not match JSONL files`);
        }
        if (report.rejectedObservations !== batchRejectedCount) {
          errors.push(`${batch.batchId}: report rejected observations do not match JSONL files`);
        }

        const manifestCities = batch.cities.map((city) => city.city).sort();
        if (JSON.stringify([...report.cities].sort()) !== JSON.stringify(manifestCities)) {
          errors.push(`${batch.batchId}: report cities do not match manifest cities`);
        }
        const allowedReportCities = new Set(manifestCities);
        for (const missing of report.missing) {
          if (!allowedReportCities.has(missing.city)) {
            errors.push(`${batch.batchId}: report missingness references undeclared city ${missing.city}`);
          }
        }
        for (const measure of CITY_COST_MEASURES) {
          const actual = batchCoverage.get(measure) ?? 0;
          const reported = report.coverage[measure] ?? 0;
          if (actual !== reported) {
            errors.push(
              `${batch.batchId}: report coverage for ${measure} is ${reported}, JSONL files contain ${actual}`
            );
          }
        }
      } catch (error) {
        errors.push(`${batch.batchId}: invalid report JSON (${error instanceof Error ? error.message : 'unknown error'})`);
      }
    }
  }
}

const observationDirectory = path.resolve(process.cwd(), 'data/reference/observations');
if (fs.existsSync(observationDirectory)) {
  const unreferenced = fs
    .readdirSync(observationDirectory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => relativeLabel(path.join(observationDirectory, name)))
    .filter((name) => !referencedObservationFiles.has(name));
  for (const file of unreferenced) errors.push(`Unreferenced observation file: ${file}`);
}

const promptPath = path.resolve(process.cwd(), manifest.researchPrompt);
if (!fs.existsSync(promptPath)) errors.push(`Research prompt does not exist: ${manifest.researchPrompt}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      input: relativeLabel(inputPath),
      valid: true,
      batches: manifest.batches.length,
      observationFiles: referencedObservationFiles.size,
      observations: observationCount,
      acceptedObservations: acceptedObservationCount,
      projectDailyCallCap: manifest.projectDailyCallCap,
      callLimitPolicy: manifest.callLimitPolicy,
    },
    null,
    2
  )
);
