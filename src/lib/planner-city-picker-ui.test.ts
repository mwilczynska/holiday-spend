import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(process.cwd());

describe('planner city picker UI', () => {
  it('uses a high-contrast selected city treatment', () => {
    const source = fs.readFileSync(
      path.join(projectRoot, 'src', 'components', 'ui', 'searchable-select.tsx'),
      'utf8'
    );

    expect(source).toContain("? 'bg-slate-900 text-white aria-selected:bg-slate-900'");
    expect(source).toContain(": 'aria-selected:bg-slate-800'");
  });

  it('keeps cancel, add-city, and add-leg actions together in the leg dialog footer', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'plan', 'page.tsx'), 'utf8');
    const footerStart = source.indexOf('<DialogFooter className="gap-2 sm:justify-end">');
    const footerEnd = source.indexOf('</DialogFooter>', footerStart);
    const footer = source.slice(footerStart, footerEnd);

    expect(footerStart).toBeGreaterThan(-1);
    expect(footer).toContain('Cancel');
    expect(footer).toContain('Add City');
    expect(footer).toContain('Add Leg');
  });

  it('reveals all legs after either existing-city or generated-city leg creation', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'plan', 'page.tsx'), 'utf8');

    expect(source.match(/setVisibleLegCount\(Number\.MAX_SAFE_INTEGER\)/g)).toHaveLength(2);
  });

  it('shows model suggestions in four columns on both generation surfaces', () => {
    const datasetPanel = fs.readFileSync(
      path.join(projectRoot, 'src', 'components', 'cities', 'CityGenerationPanel.tsx'),
      'utf8'
    );
    const plannerDialog = fs.readFileSync(
      path.join(projectRoot, 'src', 'components', 'itinerary', 'PlannerNewCityDialog.tsx'),
      'utf8'
    );

    for (const source of [datasetPanel, plannerDialog]) {
      const modelButtonsStart = source.indexOf('modelDiscovery.result.effectiveModels.slice(0, 16)');
      const modelGrid = source.slice(Math.max(0, modelButtonsStart - 100), modelButtonsStart + 1200);

      expect(modelButtonsStart).toBeGreaterThan(-1);
      expect(modelGrid).toContain('grid grid-cols-2 gap-2 sm:grid-cols-4');
      expect(modelGrid).toContain('className="col-span-2 sm:col-span-4"');
      expect(source).toMatch(/<div className="space-y-1 md:col-span-2">\s*<Label className="text-xs">Model/);
    }
  });

  it('defines every cumulative-spend data line and its visual style', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'page.tsx'), 'utf8');

    expect(source).toContain("{ label: 'Actual spend', color: '#16a34a' }");
    expect(source).toContain("{ label: 'Actual spend · leg still planned', color: '#9ca3af' }");
    expect(source).toContain("{ label: 'Planned estimate', color: '#0f766e', dashed: true }");
    expect(source).toContain("{ label: 'Total trip budget', color: '#7c3aed', dashed: true }");
  });

  it('keeps both intercity transport model pickers aligned with the city picker', () => {
    for (const filename of ['TransportEstimateDialog.tsx', 'BulkTransportEstimateDialog.tsx']) {
      const source = fs.readFileSync(
        path.join(projectRoot, 'src', 'components', 'itinerary', filename),
        'utf8'
      );

      expect(source).toContain('validateCityGenerationModel(provider, activeModel, modelDiscovery.result.effectiveModels)');
      expect(source).toContain('async function refreshModelsAndResetDefault()');
      expect(source).toContain('modelDiscovery.result.effectiveModels.slice(0, 16)');
      expect(source).toContain('grid grid-cols-2 gap-2 sm:grid-cols-4');
      expect(source).toContain('className="col-span-2 sm:col-span-4"');
      expect(source).toContain('onClick={() => void refreshModelsAndResetDefault()}');
      expect(source).toContain('Thinking / reasoning effort');
      expect(source).toContain('reasoningEffort: effectiveReasoningEffort');
      expect(source).toContain('md:col-span-2');
      expect(source).toContain('className="space-y-3 md:col-span-2"');
      expect(source).toContain('className="grid gap-3 md:grid-cols-3"');
    }
  });

  it('keeps reasoning effort beside the model picker on every LLM surface', () => {
    const filenames = [
      'src/components/cities/CityGenerationPanel.tsx',
      'src/components/itinerary/PlannerNewCityDialog.tsx',
      'src/components/itinerary/TransportEstimateDialog.tsx',
      'src/components/itinerary/BulkTransportEstimateDialog.tsx',
    ];

    for (const filename of filenames) {
      const source = fs.readFileSync(path.join(projectRoot, filename), 'utf8');
      expect(source).toContain('className="space-y-3 md:col-span-2"');
      expect(source).toContain('className="grid gap-3 md:grid-cols-3"');
      expect(source).toContain('<Label className="text-xs">Thinking / reasoning effort</Label>');
      expect(source).toContain('grid grid-cols-2 gap-2 sm:grid-cols-4');
    }
  });

  it('uses uninterrupted country blocks for dashboard comparison rows', () => {
    const source = fs.readFileSync(
      path.join(projectRoot, 'src', 'app', 'api', 'dashboard', 'planned-vs-actual', 'route.ts'),
      'utf8'
    );

    expect(source).toContain('createCountryBlockRefs');
    expect(source).toContain('plannedByBlock');
    expect(source).toContain('actualByBlock');
    expect(source).toContain('blockIndex');
  });

  it('routes bulk transport estimation through the bounded concurrent scheduler', () => {
    const source = fs.readFileSync(
      path.join(projectRoot, 'src', 'components', 'itinerary', 'BulkTransportEstimateDialog.tsx'),
      'utf8'
    );

    expect(source).toContain('runWithConcurrency(');
    expect(source).toContain('BULK_TRANSPORT_CONCURRENCY[provider]');
    expect(source).toContain('concurrently with a provider-aware request limit');
    expect(source).not.toContain('BULK_ESTIMATE_DELAY_MS');
  });

  it('shows the opt-in browser-save checkbox on every LLM API-key surface', () => {
    const filenames = [
      path.join(projectRoot, 'src', 'components', 'cities', 'CityGenerationPanel.tsx'),
      path.join(projectRoot, 'src', 'components', 'itinerary', 'PlannerNewCityDialog.tsx'),
      path.join(projectRoot, 'src', 'components', 'itinerary', 'TransportEstimateDialog.tsx'),
      path.join(projectRoot, 'src', 'components', 'itinerary', 'BulkTransportEstimateDialog.tsx'),
      path.join(projectRoot, 'src', 'app', 'plan', 'page.tsx'),
    ];

    for (const filename of filenames) {
      const source = fs.readFileSync(filename, 'utf8');
      expect(source).toContain('Save API key in this browser');
      expect(source).toContain('setSave');
    }
  });
});
