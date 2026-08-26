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

  it('shows model suggestions in two columns on both generation surfaces', () => {
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
      expect(modelGrid).toContain('grid grid-cols-2 gap-2');
      expect(modelGrid).toContain('className="col-span-2"');
    }
  });
});
