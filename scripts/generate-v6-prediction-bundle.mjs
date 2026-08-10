// Windows-friendly command wrapper. The implementation is TypeScript because
// it imports the production TypeScript path directly.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const tsx = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const result = spawnSync(tsx, [path.join('scripts', 'generate-v6-prediction-bundle.ts'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
