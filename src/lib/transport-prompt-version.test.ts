import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTransportEstimationPrompt, resolveTransportPromptFile } from '@/lib/transport-estimation';

const promptsDir = path.join(process.cwd(), 'docs', 'prompts');
const originalEnv = process.env.TRANSPORT_PROMPT_VERSION;

afterEach(() => {
  if (originalEnv === undefined) delete process.env.TRANSPORT_PROMPT_VERSION;
  else process.env.TRANSPORT_PROMPT_VERSION = originalEnv;
});

const request = {
  originCity: 'Bangkok',
  originCountry: 'Thailand',
  destinationCity: 'Phuket',
  destinationCountry: 'Thailand',
  travelDate: '2026-12-26',
  groupSize: 2,
  allowedModes: ['bus', 'flight'] as const,
};

describe('transport prompt version', () => {
  it('ships v1.1 by default and keeps v1 as an explicit rollback', () => {
    delete process.env.TRANSPORT_PROMPT_VERSION;
    expect(resolveTransportPromptFile()).toBe('llm_prompt_intercity_transport_v1_1.md');

    process.env.TRANSPORT_PROMPT_VERSION = 'v1';
    expect(resolveTransportPromptFile()).toBe('llm_prompt_intercity_transport_1.md');
  });

  it('records the prompt version actually used, so a stored estimate stays attributable', () => {
    delete process.env.TRANSPORT_PROMPT_VERSION;
    expect(buildTransportEstimationPrompt(request as never).promptVersion)
      .toBe('llm_prompt_intercity_transport_v1_1.md');

    process.env.TRANSPORT_PROMPT_VERSION = 'v1';
    expect(buildTransportEstimationPrompt(request as never).promptVersion)
      .toBe('llm_prompt_intercity_transport_1.md');
  });

  it('states the estimand, which is the whole reason v1.1 exists', () => {
    // v1 never said which fare to quote, so "how far off is it" had no defined answer: the median
    // relative error moved from 36.4% to 25.0% purely on the reference chosen to compare against.
    const v11 = fs.readFileSync(path.join(promptsDir, 'llm_prompt_intercity_transport_v1_1.md'), 'utf8');

    expect(v11).toMatch(/typical fare a traveller would actually book/);
    expect(v11).toMatch(/Do not quote the cheapest fare/);
    expect(v11).toMatch(/Do not quote a premium/);
    expect(v11).toMatch(/only when the route cannot be travelled without it/);
  });

  it('changes nothing below the estimand, so a difference in output is attributable to it', () => {
    const v1 = fs.readFileSync(path.join(promptsDir, 'llm_prompt_intercity_transport_1.md'), 'utf8');
    const v11 = fs.readFileSync(path.join(promptsDir, 'llm_prompt_intercity_transport_v1_1.md'), 'utf8');
    const tail = (text: string) => text.slice(text.indexOf('Output rules:'));

    expect(tail(v11)).toBe(tail(v1));
  });
});
