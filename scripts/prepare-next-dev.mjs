import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const nextDirectory = resolve(process.cwd(), '.next');
const databaseFiles = ['data/travel.db', 'data/travel.db-shm', 'data/travel.db-wal'].map((path) =>
  resolve(process.cwd(), path),
);

function isWindowsReparsePoint(path) {
  if (process.platform !== 'win32') return false;

  try {
    const result = execFileSync('fsutil.exe', ['reparsepoint', 'query', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.includes('Reparse Tag Value');
  } catch {
    return false;
  }
}

function pinWindowsFile(path) {
  if (process.platform !== 'win32') return;

  execFileSync('attrib', ['+P', '-U', path], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

function main() {
  if (existsSync(nextDirectory)) {
    const isLink = lstatSync(nextDirectory).isSymbolicLink();
    if (isLink || isWindowsReparsePoint(nextDirectory)) {
      try {
        rmSync(nextDirectory, { force: true, recursive: true });
      } catch (error) {
        throw new Error(
          `Cannot remove the OneDrive reparse-point .next directory at ${nextDirectory}. ` +
            'Stop other Next processes and remove .next manually before retrying npm run dev.',
          { cause: error },
        );
      }

      console.log('[dev] Removed OneDrive reparse-point .next cache before starting Next.js.');
    }
  }

  for (const databaseFile of databaseFiles) {
    if (existsSync(databaseFile) && isWindowsReparsePoint(databaseFile)) {
      pinWindowsFile(databaseFile);
      console.log(`[dev] Pinned OneDrive database file locally: ${databaseFile}`);
    }
  }
}

main();
