import fs from 'node:fs';
import path from 'node:path';
import {
  accommodationQuoteAttemptSchema,
  summarizeAccommodationQuoteAttempts,
  type AccommodationQuoteAttempt,
} from '../src/lib/accommodation-quote-attempt';

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error(
    'Usage: npm run methodology:accommodation-quotes:validate -- <attempts.jsonl|directory> [...]'
  );
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

const attempts: AccommodationQuoteAttempt[] = [];
const attemptIds = new Set<string>();
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
    const location = `${inputLabel}:${index + 1}`;
    let value: unknown;
    try {
      value = JSON.parse(lines[index]);
    } catch (error) {
      errors.push(
        `${location}: invalid JSON (${error instanceof Error ? error.message : 'unknown error'})`
      );
      continue;
    }

    const parsed = accommodationQuoteAttemptSchema.safeParse(value);
    if (!parsed.success) {
      errors.push(
        `${location}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
          .join('; ')}`
      );
      continue;
    }

    if (attemptIds.has(parsed.data.attemptId)) {
      errors.push(`${location}: duplicate attemptId ${parsed.data.attemptId}`);
      continue;
    }
    attemptIds.add(parsed.data.attemptId);

    if (
      parsed.data.observationId &&
      observationIds.has(parsed.data.observationId)
    ) {
      errors.push(
        `${location}: duplicate observationId link ${parsed.data.observationId}`
      );
      continue;
    }
    if (parsed.data.observationId) {
      observationIds.add(parsed.data.observationId);
    }
    attempts.push(parsed.data);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      inputs: inputPaths.map((inputPath) =>
        path.relative(process.cwd(), inputPath).replaceAll('\\', '/')
      ),
      valid: true,
      ...summarizeAccommodationQuoteAttempts(attempts),
    },
    null,
    2
  )
);
