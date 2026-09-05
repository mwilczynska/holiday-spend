import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DATASET_PAGE_SIZE,
  EXPENSE_PAGE_SIZE,
  getPageCount,
  getPageItems,
  getVisibleItems,
  HISTORY_PAGE_SIZE,
  INITIAL_VISIBLE_LEGS,
  VISIBLE_LEGS_INCREMENT,
} from '@/lib/performance-bounds';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const startScript = path.join(projectRoot, 'scripts', 'start-next-production.mjs');
const performanceScript = path.join(projectRoot, 'scripts', 'check-webapp-performance.mjs');
const temporaryDirectories: string[] = [];

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-spend-performance-'));
  temporaryDirectories.push(directory);
  return directory;
}

function runNodeScript(script: string, cwd: string, env: Partial<NodeJS.ProcessEnv> = {}) {
  return spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runNodeScriptAsync(script: string, cwd: string, env: Partial<NodeJS.ProcessEnv> = {}) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('v1.1 performance bounds', () => {
  it('keeps the initial planner and table render windows bounded', () => {
    const legs = Array.from({ length: 67 }, (_, index) => index);
    const cities = Array.from({ length: 195 }, (_, index) => index);
    const history = Array.from({ length: 195 }, (_, index) => index);

    expect(getVisibleItems(legs, INITIAL_VISIBLE_LEGS)).toHaveLength(12);
    expect(getVisibleItems(legs, INITIAL_VISIBLE_LEGS + VISIBLE_LEGS_INCREMENT)).toHaveLength(24);
    expect(getPageItems(cities, 0, DATASET_PAGE_SIZE)).toHaveLength(25);
    expect(getPageItems(history, 0, HISTORY_PAGE_SIZE)).toHaveLength(20);
    expect(getPageItems(Array.from({ length: 973 }, (_, index) => index), 0, EXPENSE_PAGE_SIZE)).toHaveLength(50);
    expect(getPageCount(67, INITIAL_VISIBLE_LEGS)).toBe(6);
    expect(getPageCount(195, DATASET_PAGE_SIZE)).toBe(8);
    expect(getPageCount(195, HISTORY_PAGE_SIZE)).toBe(10);
  });

  it('rejects invalid pagination inputs instead of silently widening a render', () => {
    expect(() => getPageCount(-1, DATASET_PAGE_SIZE)).toThrow();
    expect(() => getPageItems([], -1, HISTORY_PAGE_SIZE)).toThrow();
    expect(() => getVisibleItems([], 1.5)).toThrow();
  });

  it('fails production startup with an actionable message when the build is absent', () => {
    const directory = makeTempDir();
    const result = runNodeScript(startScript, directory);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('No complete production build was found');
    expect(output).toContain('npm run build');
  });

  it('stages static and public assets beside the standalone server before startup', () => {
    const directory = makeTempDir();
    fs.mkdirSync(path.join(directory, '.next', 'standalone'), { recursive: true });
    fs.mkdirSync(path.join(directory, '.next', 'static', 'chunks'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'public'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'docs', 'prompts'), { recursive: true });
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), 'test-build');
    fs.writeFileSync(path.join(directory, '.next', 'standalone', 'server.js'), '');
    fs.writeFileSync(path.join(directory, '.next', 'static', 'chunks', 'app.js'), 'client');
    fs.writeFileSync(path.join(directory, 'public', 'icon.svg'), '<svg />');
    fs.writeFileSync(path.join(directory, 'docs', 'prompts', 'llm_prompt_new_cities_1.md'), 'v1 prompt');
    fs.writeFileSync(path.join(directory, 'docs', 'prompts', 'llm_prompt_new_cities_v1_1.md'), 'v1.1 prompt');
    // Staged explicitly rather than left to Next's tracing, which only follows string literals.
    fs.writeFileSync(path.join(directory, 'docs', 'prompts', 'llm_prompt_intercity_transport_1.md'), 'transport v1');
    fs.writeFileSync(path.join(directory, 'docs', 'prompts', 'llm_prompt_intercity_transport_v1_1.md'), 'transport v1.1');

    const result = runNodeScript(startScript, directory);

    expect(result.status).toBe(0);
    for (const promptFile of [
      'llm_prompt_intercity_transport_1.md',
      'llm_prompt_intercity_transport_v1_1.md',
    ]) {
      expect(fs.existsSync(path.join(directory, '.next', 'standalone', 'docs', 'prompts', promptFile))).toBe(true);
    }
    expect(fs.readFileSync(
      path.join(directory, '.next', 'standalone', '.next', 'static', 'chunks', 'app.js'),
      'utf8',
    )).toBe('client');
    expect(fs.readFileSync(path.join(directory, '.next', 'standalone', 'public', 'icon.svg'), 'utf8'))
      .toBe('<svg />');
    expect(fs.readFileSync(
      path.join(directory, '.next', 'standalone', 'docs', 'prompts', 'llm_prompt_new_cities_v1_1.md'),
      'utf8',
    )).toBe('v1.1 prompt');
    expect(fs.readFileSync(path.join(directory, '.next', 'standalone', '.holiday-spend-build-id'), 'utf8'))
      .toBe('test-build\n');
  });

  it('fails the performance check before probing routes when the build is absent', () => {
    const directory = makeTempDir();
    const result = runNodeScript(performanceScript, directory, {
      WEBAPP_ROUTE_BUDGET_MS: '50',
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('No complete production build found');
    expect(output).not.toContain('was not reachable');
  });

  it('enforces route readiness and shell response budgets', async () => {
    const directory = makeTempDir();
    fs.mkdirSync(path.join(directory, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), 'test-build');
    fs.writeFileSync(path.join(directory, '.next', 'standalone', 'server.js'), '');

    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>ready</body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Test server did not expose a TCP port.');
    }

    try {
      const result = await runNodeScriptAsync(performanceScript, directory, {
        WEBAPP_BASE_URL: `http://127.0.0.1:${address.port}`,
        WEBAPP_ROUTE_BUDGET_MS: '1000',
        WEBAPP_RESPONSE_BUDGET_BYTES: '1024',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Route-shell check passed');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fails when a route exceeds the configured shell budget', async () => {
    const directory = makeTempDir();
    fs.mkdirSync(path.join(directory, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), 'test-build');
    fs.writeFileSync(path.join(directory, '.next', 'standalone', 'server.js'), '');

    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('x'.repeat(2048));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Test server did not expose a TCP port.');
    }

    try {
      const result = await runNodeScriptAsync(performanceScript, directory, {
        WEBAPP_BASE_URL: `http://127.0.0.1:${address.port}`,
        WEBAPP_ROUTE_BUDGET_MS: '1000',
        WEBAPP_RESPONSE_BUDGET_BYTES: '1024',
      });

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain('above the 1024-byte shell budget');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fails when a route shell references a missing static asset', async () => {
    const directory = makeTempDir();
    fs.mkdirSync(path.join(directory, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), 'test-build');
    fs.writeFileSync(path.join(directory, '.next', 'standalone', 'server.js'), '');

    const server = createServer((request, response) => {
      if (request.url?.startsWith('/_next/static/')) {
        response.writeHead(404, { 'content-type': 'text/plain' });
        response.end('missing');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><script src="/_next/static/chunks/missing.js"></script></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Test server did not expose a TCP port.');
    }

    try {
      const result = await runNodeScriptAsync(performanceScript, directory, {
        WEBAPP_BASE_URL: `http://127.0.0.1:${address.port}`,
        WEBAPP_ROUTE_BUDGET_MS: '1000',
        WEBAPP_RESPONSE_BUDGET_BYTES: '1024',
      });

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain('/_next/static/chunks/missing.js returned HTTP 404');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fails when routes redirect to the login page instead of rendering', async () => {
    // The original defect: `redirect: 'follow'` with no session cookie meant every route
    // 307'd to /login and the script happily measured the login page seven times. This test
    // exists so that regression cannot return silently.
    const directory = makeTempDir();
    fs.mkdirSync(path.join(directory, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), 'test-build');
    fs.writeFileSync(path.join(directory, '.next', 'standalone', 'server.js'), '');

    const server = createServer((request, response) => {
      if (request.url?.startsWith('/login')) {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<html><body>sign in</body></html>');
        return;
      }
      response.writeHead(307, { location: '/login?callbackUrl=%2F' });
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Test server did not expose a TCP port.');
    }

    try {
      const result = await runNodeScriptAsync(performanceScript, directory, {
        WEBAPP_BASE_URL: `http://127.0.0.1:${address.port}`,
        WEBAPP_ROUTE_BUDGET_MS: '1000',
        WEBAPP_RESPONSE_BUDGET_BYTES: '1024',
        WEBAPP_SAMPLES: '1',
        WEBAPP_JS_BUDGET_BYTES: '0',
      });

      expect(result.status).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toContain('redirected to /login');
      expect(output).toContain('would describe the login');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('can measure a development server when the build requirement is waived', async () => {
    const directory = makeTempDir();

    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>dev</body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Test server did not expose a TCP port.');
    }

    try {
      const result = await runNodeScriptAsync(performanceScript, directory, {
        WEBAPP_BASE_URL: `http://127.0.0.1:${address.port}`,
        WEBAPP_ROUTE_BUDGET_MS: '1000',
        WEBAPP_RESPONSE_BUDGET_BYTES: '1024',
        WEBAPP_REQUIRE_BUILD: 'false',
        WEBAPP_SAMPLES: '1',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Route-shell check passed');
      expect(result.stdout).toContain('No session was configured');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports the median of repeated route samples', async () => {
    const directory = makeTempDir();
    fs.mkdirSync(path.join(directory, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), 'test-build');
    fs.writeFileSync(path.join(directory, '.next', 'standalone', 'server.js'), '');

    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>ready</body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Test server did not expose a TCP port.');
    }

    try {
      const result = await runNodeScriptAsync(performanceScript, directory, {
        WEBAPP_BASE_URL: `http://127.0.0.1:${address.port}`,
        WEBAPP_ROUTE_BUDGET_MS: '1000',
        WEBAPP_RESPONSE_BUDGET_BYTES: '1024',
        WEBAPP_SAMPLES: '3',
        WEBAPP_JS_BUDGET_BYTES: '0',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('median of 3');
      // Seven routes at three samples each.
      expect(requestCount).toBe(21);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
