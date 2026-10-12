import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createDataSnapshot, verifyDataSnapshot } from './lib/data-snapshot.mjs';
import { hashPassword } from '../src/lib/password';

async function main() {
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
const destination = option('--destination');
if (!destination) throw new Error('Supply --destination with a new snapshot directory.');
if (args.includes('--verify')) {
  const manifest = verifyDataSnapshot(destination);
  console.log(`Snapshot verified: ${manifest.tables.cities.count} cities, ${Object.keys(manifest.files).length - 1} photo files.`);
} else {
  const ownerEmail = option('--owner-email');
  const manifest = await createDataSnapshot({
    source: option('--source') ?? process.env.HOLIDAY_SPEND_DB_PATH ?? path.resolve('data/travel.db'),
    destination,
    mode: option('--mode') ?? 'full',
    ownerEmail,
    ownerId: option('--owner-id') ?? 'dev-local-user',
    ownerPasswordHash: ownerEmail ? await hashPassword(randomBytes(64).toString('base64url')) : undefined,
  });
  verifyDataSnapshot(destination);
  console.log(`Snapshot created and verified: ${manifest.tables.cities.count} cities, ${Object.keys(manifest.files).length - 1} photo files. Source unchanged.`);
}
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Snapshot failed.'); process.exitCode = 1; });
