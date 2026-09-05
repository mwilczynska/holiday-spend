import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const projectRoot = process.cwd();
const buildIdPath = resolve(projectRoot, '.next', 'BUILD_ID');
const standaloneRoot = resolve(projectRoot, '.next', 'standalone');
const standaloneServerPath = resolve(projectRoot, '.next', 'standalone', 'server.js');
const staticSourcePath = resolve(projectRoot, '.next', 'static');
const promptSourcePath = resolve(projectRoot, 'docs', 'prompts');
/**
 * Staged explicitly rather than left to Next's file tracing. Tracing picks up a prompt only when
 * the path appears as a string literal, so a prompt selected through a lookup table can be missing
 * from the bundle while working perfectly in development.
 */
const requiredPromptFiles = [
  'llm_prompt_new_cities_1.md',
  'llm_prompt_new_cities_v1_1.md',
  'llm_prompt_intercity_transport_1.md',
  'llm_prompt_intercity_transport_v1_1.md',
];

if (
  !existsSync(buildIdPath)
  || !existsSync(standaloneServerPath)
  || !existsSync(staticSourcePath)
  || requiredPromptFiles.some((fileName) => !existsSync(resolve(promptSourcePath, fileName)))
) {
  console.error(
    '[start] No complete production build was found. Run `npm run build` from the project root, then retry `npm start`.',
  );
  process.exit(1);
}

loadEnvConfig(projectRoot);

const staticDestinationPath = resolve(standaloneRoot, '.next', 'static');
const promptDestinationPath = resolve(standaloneRoot, 'docs', 'prompts');
const stagedBuildIdPath = resolve(standaloneRoot, '.holiday-spend-build-id');
const buildId = readFileSync(buildIdPath, 'utf8').trim();
const stagedBuildId = existsSync(stagedBuildIdPath)
  ? readFileSync(stagedBuildIdPath, 'utf8').trim()
  : null;

if (stagedBuildId !== buildId) {
  mkdirSync(dirname(staticDestinationPath), { recursive: true });
  cpSync(staticSourcePath, staticDestinationPath, { recursive: true, force: true });

  const publicSourcePath = resolve(projectRoot, 'public');
  if (existsSync(publicSourcePath)) {
    cpSync(publicSourcePath, resolve(standaloneRoot, 'public'), { recursive: true, force: true });
  }

  writeFileSync(stagedBuildIdPath, `${buildId}\n`, 'utf8');
}

if (requiredPromptFiles.some((fileName) => !existsSync(resolve(promptDestinationPath, fileName)))) {
  mkdirSync(promptDestinationPath, { recursive: true });
  for (const fileName of requiredPromptFiles) {
    cpSync(resolve(promptSourcePath, fileName), resolve(promptDestinationPath, fileName), { force: true });
  }
}

// `next build` traces `data/travel.db` into the standalone bundle, and
// `outputFileTracingExcludes` did not prevent it. The copy is private data and, before the
// HOLIDAY_SPEND_DB_PATH fix below, was what production actually read and wrote — so writes
// were silently discarded on the next build. Remove it explicitly; nothing should read it.
const bundledDataPath = resolve(standaloneRoot, 'data');
if (existsSync(bundledDataPath)) {
  rmSync(bundledDataPath, { recursive: true, force: true });
  console.log('[start] Removed the database copy traced into the standalone bundle.');
}

if (!existsSync(resolve(projectRoot, 'data', 'travel.db'))) {
  console.warn('[start] No database at data/travel.db; the app will create an empty one.');
}

const child = spawn(process.execPath, [standaloneServerPath], {
  cwd: projectRoot,
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    PORT: process.env.PORT || '3000',
    // The standalone server chdir()s into its own directory, so the app cannot find the real
    // database from process.cwd(). Pass the project-root path explicitly.
    HOLIDAY_SPEND_DB_PATH:
      process.env.HOLIDAY_SPEND_DB_PATH || resolve(projectRoot, 'data', 'travel.db'),
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`[start] Could not start the standalone server: ${error.message}`);
  process.exit(1);
});

/**
 * The child's exit is forwarded to this process below, but nothing went the other way, so killing
 * this wrapper left the standalone server running. It keeps holding `.next/standalone`, and the
 * next `next build` then blocks while cleaning that directory, producing an empty log rather than
 * an error — which is a slow thing to diagnose.
 *
 * Windows has no process groups to signal, so the child is killed explicitly. `exit` covers the
 * ordinary paths; the signal handlers cover Ctrl+C and a terminating `kill`, and they re-raise so
 * this process still reports the signal it was given.
 */
let stoppingChild = false;
function stopChild() {
  if (stoppingChild || child.exitCode !== null || child.signalCode !== null) return;
  stoppingChild = true;
  child.kill();
}

process.on('exit', stopChild);

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  const handler = () => {
    stopChild();
    // Remove this exact listener before re-raising, or the re-raise re-enters it.
    process.off(signal, handler);
    process.kill(process.pid, signal);
  };
  process.on(signal, handler);
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
