import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const projectRoot = process.cwd();
const buildIdPath = resolve(projectRoot, '.next', 'BUILD_ID');
const standaloneServerPath = resolve(projectRoot, '.next', 'standalone', 'server.js');

if (!existsSync(buildIdPath) || !existsSync(standaloneServerPath)) {
  console.error(
    '[start] No complete production build was found. Run `npm run build` from the project root, then retry `npm start`.',
  );
  process.exit(1);
}

loadEnvConfig(projectRoot);

const child = spawn(process.execPath, [standaloneServerPath], {
  cwd: projectRoot,
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    PORT: process.env.PORT || '3000',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`[start] Could not start the standalone server: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
