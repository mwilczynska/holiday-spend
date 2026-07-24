import fs from 'node:fs';
import path from 'node:path';
import {
  accommodationPropertyPanelCollectionSchema,
  summarizeAccommodationPropertyPanels,
} from '../src/lib/accommodation-property-panel';
import { accommodationReferenceWindowScheduleSchema } from '../src/lib/accommodation-reference-window';

const panelPath = path.resolve(
  process.cwd(),
  'data/reference/accommodation_property_panels_2026_2027.json'
);
const schedulePath = path.resolve(
  process.cwd(),
  'data/reference/accommodation_reference_windows_2026_2027.json'
);

const collection = accommodationPropertyPanelCollectionSchema.parse(
  JSON.parse(fs.readFileSync(panelPath, 'utf8'))
);
const schedule = accommodationReferenceWindowScheduleSchema.parse(
  JSON.parse(fs.readFileSync(schedulePath, 'utf8'))
);

if (collection.scheduleId !== schedule.scheduleId) {
  throw new Error(
    `Panel schedule ${collection.scheduleId} does not match reference-window schedule ${schedule.scheduleId}`
  );
}
if (
  collection.protocol.targetPanelPropertiesPerMeasure !==
  schedule.protocol.targetPanelPropertiesPerMeasure
) {
  throw new Error('Panel target size does not match the reference-window protocol');
}
if (collection.protocol.searchRadiusKm !== schedule.protocol.searchRadiusKm) {
  throw new Error('Panel search radius does not match the reference-window protocol');
}

const scheduledCityKeys = new Set(
  schedule.cities.map((city) => `${city.city}\u001f${city.country}`)
);
for (const city of collection.cities) {
  if (!scheduledCityKeys.has(`${city.city}\u001f${city.country}`)) {
    throw new Error(`${city.city}, ${city.country} is not in the reference-window schedule`);
  }
}

const summary = summarizeAccommodationPropertyPanels(collection);
console.log(`Validated ${path.relative(process.cwd(), panelPath)}`);
console.log(`Collection: ${summary.collectionId}`);
console.log(`Cities with frozen sampling frames: ${summary.cities} of ${schedule.cities.length}`);
console.log(
  `Panels: ${summary.frozenHotelPanels} hotel frozen, ${summary.unavailableHostelPanels} hostel unavailable in current frames`
);
console.log(
  `Properties: ${summary.eligibleRegisterProperties} registry eligible, ${summary.eligibleInRadiusProperties} in radius, ${summary.primaryProperties} primary, ${summary.reserveProperties} reserve`
);
console.log(
  `Visible exclusions: ${summary.missingOfficialGeolocation} missing official coordinates, ${summary.outsideRadius} outside radius`
);
console.log(`Official property websites verified: ${summary.websitesVerified}`);
