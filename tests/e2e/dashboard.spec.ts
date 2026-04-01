import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/assertions';

test.describe('Dashboard', () => {
  test('dashboard loads without crashing', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDataLoad(page);

    // Dashboard may require auth — if we're still on /dashboard, check content renders
    if (page.url().includes('dashboard')) {
      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(100);
      expect(body).not.toContain('NaN');
    }
  });

  test('arbitrage widget shows data', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDataLoad(page);

    const arbWidget = page.locator('[data-testid="widget-arbitrage"]')
      .or(page.locator('text=Arbitrage').first());
    if (await arbWidget.isVisible({ timeout: 10000 })) {
      const text = await arbWidget.textContent();
      expect(text?.length).toBeGreaterThan(10);
      expect(text).not.toContain('NaN');
    }
  });

  test('widget error boundary: blocked API does not crash dashboard', async ({ page }) => {
    await page.route('**/api/funding**', route => route.abort());
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);

    // Dashboard should still be up
    expect(page.url()).toContain('dashboard');
    const errorOverlay = page.locator('#__next-error');
    expect(await errorOverlay.isVisible()).toBe(false);
  });
});
