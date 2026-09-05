import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fails a build that would otherwise hang.
 *
 * `npm start` runs `.next/standalone/server.js`, which `chdir()`s into its own directory. Windows
 * locks a directory that is any process's working directory, so while that server is alive
 * `next build` blocks trying to clean `.next` — and it blocks silently, producing no output at
 * all rather than an error. Two builds were lost to this before the cause was found.
 *
 * The launcher now stops its child when it exits, but that only covers the launcher actually
 * getting the chance to run: a force-kill of the launcher, or a tool that kills the shell rather
 * than the process tree, still leaves the server running. So the condition is detected here
 * instead of assumed away.
 *
 * Renaming the directory to itself-plus-a-suffix and straight back is the probe: it is the same
 * operation the build is about to attempt, so it cannot disagree with the build about whether the
 * directory is free. It is a no-op when nothing holds the directory.
 */
const standaloneRoot = resolve(process.cwd(), '.next', 'standalone');

if (!existsSync(standaloneRoot)) {
  process.exit(0);
}

const probePath = `${standaloneRoot}.build-probe`;

try {
  renameSync(standaloneRoot, probePath);
  renameSync(probePath, standaloneRoot);
} catch (error) {
  if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) {
    // Anything else is not the condition this guards; let the build proceed and report for itself.
    process.exit(0);
  }

  console.error(
    [
      '[build] A production server still has .next/standalone open, so this build would hang',
      '[build] while cleaning .next — with no output at all, not an error.',
      '',
      '[build] Stop it first, then rerun the build. To find it:',
      '[build]   Windows    Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" |',
      '[build]                Where-Object { $_.CommandLine -like \'*standalone*server.js*\' }',
      '[build]   macOS/Linux  pgrep -af "standalone/server.js"',
      '',
      `[build] (probe: ${error.code} renaming ${standaloneRoot})`,
    ].join('\n')
  );
  process.exit(1);
}
