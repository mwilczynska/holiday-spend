import fs from 'node:fs';
import path from 'node:path';
import { accommodationPropertyPanelCollectionSchema } from '../src/lib/accommodation-property-panel';
import { accommodationWebsiteVerificationSchema } from '../src/lib/accommodation-website-verification';

const root = process.cwd();
const panelPath = path.join(root, 'data/reference/accommodation_property_panels_2026_2027.json');
const verificationPath = path.join(root, 'data/reference/accommodation_website_verifications/barcelona-4star-primary-2026-07-24.json');
const check = process.argv.includes('--check');

const panelText = fs.readFileSync(panelPath, 'utf8');
const collection = accommodationPropertyPanelCollectionSchema.parse(JSON.parse(panelText));
const verification = accommodationWebsiteVerificationSchema.parse(JSON.parse(fs.readFileSync(verificationPath, 'utf8')));
const city = collection.cities.find((candidate) => candidate.panelId === verification.panelId);
if (!city || city.city !== verification.city || city.country !== verification.country) {
  throw new Error(`Verification panel identity does not match ${verification.panelId}`);
}

for (const record of verification.records) {
  const property = city.properties.find((candidate) => candidate.propertyId === record.propertyId);
  const measurePanel = city.measurePanels.find((candidate) => candidate.measure === record.measure);
  const ranked = measurePanel?.rankedProperties.find((candidate) => candidate.propertyId === record.propertyId);
  if (!property || !measurePanel || !ranked || ranked.selectionRank !== record.selectionRank || ranked.disposition !== 'primary') {
    throw new Error(`Verification no longer matches frozen ranking for ${record.propertyId}`);
  }
  if (!property.eligibleMeasures.includes(record.measure)) {
    throw new Error(`Verification measure is not eligible for ${record.propertyId}`);
  }
  if (property.websiteVerificationStatus === 'verified' && property.officialWebsiteUrl !== record.officialWebsiteUrl) {
    throw new Error(`Verified website conflicts for ${record.propertyId}`);
  }
  property.officialWebsiteUrl = record.officialWebsiteUrl;
  property.websiteVerificationStatus = 'verified';
}

const validated = accommodationPropertyPanelCollectionSchema.parse(collection);
const serialized = `${JSON.stringify(validated, null, 2)}\n`;
if (check) {
  if (panelText !== serialized) throw new Error('Accommodation property panels are stale; run npm run methodology:accommodation:websites');
} else {
  fs.writeFileSync(panelPath, serialized, 'utf8');
}

console.log(JSON.stringify({
  valid: true,
  mode: check ? 'check' : 'write',
  verificationId: verification.verificationId,
  verifiedProperties: verification.records.length,
  pendingTargetPrimaryProperties: city.measurePanels
    .filter((panel) => verification.records.some((record) => record.measure === panel.measure))
    .flatMap((panel) => panel.rankedProperties)
    .filter((ranked) => ranked.disposition === 'primary')
    .filter((ranked) => city.properties.find((property) => property.propertyId === ranked.propertyId)?.websiteVerificationStatus !== 'verified').length,
}, null, 2));
