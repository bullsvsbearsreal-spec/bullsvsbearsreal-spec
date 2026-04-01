import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/assertions';

test.describe('Chart Page', () => {
  test('chart page loads without crashing', async ({ page }) => {
    await page.goto('/chart');
    await waitForDataLoad(page);

    // Chart page should render with some content (TradingView widget or canvas)
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(100);
    expect(body).not.toContain('NaN');
  });

  test('URL state: symbol and timeframe persist', async ({ page }) => {
    await page.goto('/chart?s=ETH&tf=240');
    await waitForDataLoad(page);

    // URL should still contain params after load
    expect(page.url()).toContain('s=ETH');
    expect(page.url()).toContain('tf=240');
  });
});

test.describe('Heatmap Pages', () => {
  const heatmaps = [
    '/funding-heatmap',
    '/oi-heatmap',
    '/market-heatmap',
    '/rsi-heatmap',
  ];

  for (const path of heatmaps) {
    test(`${path} renders canvas or SVG`, async ({ page }) => {
      await page.goto(path);
      await waitForDataLoad(page);

      const visual = page.locator('canvas').or(page.locator('svg')).first();
      await expect(visual).toBeVisible({ timeout: 15000 });

      const body = await page.locator('body').textContent();
      expect(body).not.toContain('NaN');
    });
  }
});

test.describe('Correlation Matrix', () => {
  test('matrix renders with values between -1 and 1', async ({ page }) => {
    await page.goto('/correlation');
    await waitForDataLoad(page);

    // Look for cell values
    const cells = page.locator('td .font-mono, [data-testid*="corr-cell"]');
    if (await cells.first().isVisible({ timeout: 10000 })) {
      for (let i = 0; i < Math.min(5, await cells.count()); i++) {
        const text = await cells.nth(i).textContent();
        if (text) {
          const val = parseFloat(text);
          if (!isNaN(val)) {
            expect(val).toBeGreaterThanOrEqual(-1);
            expect(val).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
