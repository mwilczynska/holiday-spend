/**
 * `npm run dev`: starts `next dev` (arguments pass through, e.g. `-- -p 3001`) with sign-in
 * redirects that follow the port actually serving the page.
 *
 * NextAuth otherwise builds its redirects from NEXTAUTH_URL in `.env.local`, which names one port
 * per checkout (main 3000, the bento worktree 3001). When `next dev` started on a different port
 * (its default, or the next free one), "Sign in" and "Enter dev mode" succeeded and then sent the
 * browser to a port with nothing listening, which looked like a stuck button.
 *
 * AUTH_TRUST_HOST makes NextAuth use the request's own host instead. That trusts the Host header,
 * which is only appropriate for a local development server, so it is set here and never for
 * `npm start`. An explicit AUTH_TRUST_HOST in the environment is respected.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const env = { ...process.env, AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? 'true' };

const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env });
const forward = (signal) => () => { if (!child.killed) child.kill(signal); };
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
