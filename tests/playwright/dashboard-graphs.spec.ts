import { test, expect } from '@playwright/test';

test.describe('dashboard graphs audit', () => {
  test('inspect inline and expanded dashboard charts', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Wanderledger' }).first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'Expand' }).first()).toBeVisible({ timeout: 15_000 });

    const expandButtons = page.getByRole('button', { name: 'Expand' });
    const buttonCount = await expandButtons.count();

    const summary = await page.evaluate(() => {
      const charts = Array.from(document.querySelectorAll('.recharts-responsive-container')).map((container) => {
        const host = container.parentElement;
        const rect = container.getBoundingClientRect();
        const hostRect = host?.getBoundingClientRect();
        const svg = container.querySelector('svg');
        const textNodes = svg ? Array.from(svg.querySelectorAll('text')) : [];
        const linePaths = svg ? Array.from(svg.querySelectorAll('path.recharts-line-curve')) : [];
        const bars = svg ? Array.from(svg.querySelectorAll('path.recharts-rectangle')) : [];

        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hostWidth: hostRect ? Math.round(hostRect.width) : null,
          hostHeight: hostRect ? Math.round(hostRect.height) : null,
          textCount: textNodes.length,
          sampleFontSizes: Array.from(new Set(textNodes.map((node) => window.getComputedStyle(node).fontSize))).slice(0, 6),
          lineStrokeWidths: Array.from(new Set(linePaths.map((node) => node.getAttribute('stroke-width')))),
          barCount: bars.length,
        };
      });

      return { charts };
    });

    console.log(`INLINE_CHART_SUMMARY ${JSON.stringify(summary)}`);
    await page.screenshot({ path: testInfo.outputPath('dashboard-inline-audit.png'), fullPage: true });

    for (let index = 0; index < buttonCount; index += 1) {
      await expandButtons.nth(index).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const expandedSummary = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const charts = Array.from(element.querySelectorAll('.recharts-responsive-container')).map((container) => {
          const svg = container.querySelector('svg');
          const textNodes = svg ? Array.from(svg.querySelectorAll('text')) : [];
          const linePaths = svg ? Array.from(svg.querySelectorAll('path.recharts-line-curve')) : [];
          const bars = svg ? Array.from(svg.querySelectorAll('path.recharts-rectangle')) : [];
          const containerRect = container.getBoundingClientRect();

          return {
            width: Math.round(containerRect.width),
            height: Math.round(containerRect.height),
            textCount: textNodes.length,
            sampleFontSizes: Array.from(new Set(textNodes.map((node) => window.getComputedStyle(node).fontSize))).slice(0, 6),
            lineStrokeWidths: Array.from(new Set(linePaths.map((node) => node.getAttribute('stroke-width')))),
            barCount: bars.length,
          };
        });
        const firstChart = element.querySelector('.recharts-responsive-container') as HTMLElement | null;
        const firstChartRect = firstChart?.getBoundingClientRect();

        return {
          dialogWidth: Math.round(rect.width),
          dialogHeight: Math.round(rect.height),
          chartTopOffset: firstChartRect ? Math.round(firstChartRect.top - rect.top) : null,
          charts,
        };
      });

      console.log(`EXPANDED_CHART_${index + 1} ${JSON.stringify(expandedSummary)}`);
      await page.screenshot({ path: testInfo.outputPath(`dashboard-expanded-audit-${index + 1}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });
});
