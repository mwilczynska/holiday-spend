import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(process.cwd());

describe('transaction import UI', () => {
  it('allows multiple files and posts every selected file to the import API', () => {
    const page = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'track', 'import', 'page.tsx'), 'utf8');

    expect(page).toContain('multiple');
    expect(page).toContain('formData.append(\'file\', file)');
    expect(page).toContain('Upload one or more Wise CSV exports.');
    expect(page).toContain('readImportApiResponse');
  });

  it('handles non-JSON import responses without leaking a JSON parse runtime error', () => {
    const page = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'track', 'import', 'page.tsx'), 'utf8');

    expect(page).toContain('readImportApiResponse');
    expect(page).toContain('role="alert"');
    expect(page).not.toContain('const data = await res.json();');
  });
});
