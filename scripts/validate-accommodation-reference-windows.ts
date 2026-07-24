import fs from 'node:fs';
import path from 'node:path';
import {
  accommodationReferenceWindowScheduleSchema,
  summarizeAccommodationReferenceWindows,
} from '../src/lib/accommodation-reference-window';

const schedulePath = path.resolve(
  process.cwd(),
  'data/reference/accommodation_reference_windows_2026_2027.json'
);

const schedule = accommodationReferenceWindowScheduleSchema.parse(
  JSON.parse(fs.readFileSync(schedulePath, 'utf8'))
);
const summary = summarizeAccommodationReferenceWindows(schedule);

console.log(`Validated ${path.relative(process.cwd(), schedulePath)}`);
console.log(`Schedule: ${summary.scheduleId}`);
console.log(`Cities: ${summary.cities}`);
console.log(`Windows: ${summary.windows}`);
console.log(
  `Season strata: low=${summary.seasons.low}, shoulder=${summary.seasons.shoulder}, high=${summary.seasons.high}`
);
console.log(`Next quote capture: ${summary.nextQuoteCaptureDate ?? 'none'}`);
console.log(`Pending capture-day event reviews: ${summary.pendingEventReviews}`);
