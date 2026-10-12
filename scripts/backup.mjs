import path from 'node:path';
import { createDataSnapshot, restoreDataSnapshot, verifyDataSnapshot } from './lib/data-snapshot.mjs';

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}.`);
  return args[index + 1];
}
try {
  const destination = option('--destination');
  if (!destination) throw new Error('Supply --destination with the snapshot or new restore directory.');
  let manifest;
  const restoreFrom = option('--restore-from');
  if (restoreFrom) manifest = restoreDataSnapshot(restoreFrom, destination);
  else if (args.includes('--verify')) manifest = verifyDataSnapshot(destination);
  else {
    manifest = await createDataSnapshot({
      source: option('--source') ?? process.env.HOLIDAY_SPEND_DB_PATH ?? path.resolve('data/travel.db'),
      destination,
      mode: 'full',
    });
    verifyDataSnapshot(destination);
  }
  console.log(`Verified ${manifest.tables.cities.count} cities and ${Object.keys(manifest.files).length - 1} photo files.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup/restore failed.');
  process.exitCode = 1;
}
