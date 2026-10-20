import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNTIME_PROMPT_FILES } from '../../scripts/lib/runtime-prompts.mjs';
import { CITY_COST_V11_PROMPT_VERSION } from './city-cost-methodology-v1-1';
import { CITY_COST_V12_PROMPT_VERSION } from './city-cost-methodology-v1-2';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('runtime prompt packaging', () => {
  it('lists every prompt the server can load', () => {
    const transportSource = read('src/lib/transport-estimation.ts');
    const transportFiles = [...transportSource.matchAll(/'(llm_prompt_intercity_transport_[^']+\.md)'/g)].map(match => match[1]);
    expect(transportFiles.length).toBeGreaterThan(0);
    for (const file of ['llm_prompt_new_cities_1.md', CITY_COST_V11_PROMPT_VERSION, CITY_COST_V12_PROMPT_VERSION, ...transportFiles]) {
      expect(RUNTIME_PROMPT_FILES).toContain(file);
    }
  });

  it('packages every listed prompt in the Docker image', () => {
    const dockerfile = read('Dockerfile');
    for (const file of RUNTIME_PROMPT_FILES) {
      expect(fs.existsSync(path.join(root, 'docs', 'prompts', file))).toBe(true);
      expect(dockerfile).toContain(`/app/docs/prompts/${file}`);
    }
    expect(dockerfile).toContain('/app/scripts/lib/runtime-prompts.mjs');
  });
});
