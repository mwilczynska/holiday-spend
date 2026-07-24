import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CityCostResearchResponseError,
  parseCityCostResearchResponse,
  renderCityCostResearchPrompt,
} from './city-cost-research-response';

const fixturePath = path.join(
  process.cwd(),
  'src/lib/fixtures/city-cost-research-response/lisbon-food-drinks-partial.json'
);
const assignmentFixturePath = path.join(
  process.cwd(),
  'src/lib/fixtures/city-cost-research-response/lisbon-food-drinks-assignment.json'
);
const fixture = fs.readFileSync(fixturePath, 'utf8');
const assignment = JSON.parse(fs.readFileSync(assignmentFixturePath, 'utf8'));

describe('city cost research response runner', () => {
  it('parses a fixture response and preserves the unreviewed gate', () => {
    const response = parseCityCostResearchResponse(fixture, assignment);
    expect(response.call.status).toBe('partial');
    expect(response.observations).toHaveLength(1);
    expect(response.observations[0]).toMatchObject({
      measure: 'cappuccino_1',
      reviewerStatus: 'unreviewed',
    });
    expect(response.missing).toHaveLength(5);
  });

  it('accepts one JSON code fence but rejects surrounding prose', () => {
    expect(
      parseCityCostResearchResponse(`\`\`\`json\n${fixture}\n\`\`\``, assignment)
        .observations
    ).toHaveLength(1);
    expect(() =>
      parseCityCostResearchResponse(`Here is the result:\n${fixture}`, assignment)
    ).toThrow(CityCostResearchResponseError);
  });

  it('rejects a response for a different assigned city', () => {
    expect(() =>
      parseCityCostResearchResponse(fixture, { ...assignment, city: 'Prague' })
    ).toThrow(/call.city: expected Prague/);
  });

  it('requires every assigned measure to be observed or explicitly missing', () => {
    const parsed = JSON.parse(fixture);
    parsed.missing = parsed.missing.filter(
      (entry: { measure: string }) => entry.measure !== 'wine_glass_1'
    );
    expect(() =>
      parseCityCostResearchResponse(JSON.stringify(parsed), assignment)
    ).toThrow(/wine_glass_1 must be observed or explicitly missing/);
  });

  it('does not allow the research response to self-accept an observation', () => {
    const parsed = JSON.parse(fixture);
    parsed.observations[0].reviewerStatus = 'accepted';
    expect(() =>
      parseCityCostResearchResponse(JSON.stringify(parsed), assignment)
    ).toThrow(/runner output must remain unreviewed/);
  });

  it('renders every assignment placeholder and detects unknown variables', () => {
    const rendered = renderCityCostResearchPrompt(
      '{{city}}|{{country}}|{{region}}|{{category}}|{{batch_id}}|{{reference_date}}|{{pricing_window}}|{{context}}',
      assignment
    );
    expect(rendered).toBe(
      'Lisbon|Portugal|Europe|food_drinks|fixture-batch|2026-07-24|Current public city prices|Fixture assignment.'
    );
    expect(() =>
      renderCityCostResearchPrompt('{{city}} {{unknown_value}}', assignment)
    ).toThrow(/unresolved template variables/);
  });
});
