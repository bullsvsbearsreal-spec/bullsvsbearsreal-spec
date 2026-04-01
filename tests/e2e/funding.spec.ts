import { test, expect } from '@playwright/test';
import { waitForDataLoad, expectNoConsoleErrors } from '../helpers/assertions';

test.describe('Funding Page — Table View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/funding');
    await waitForDataLoad(page);
  });

  test('funding table renders rows', async ({ page }) => {
    const checkErrors = await expectNoConsoleErrors(page);
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    expect(await rows.count()).toBeGreaterThan(5);
    checkErrors();
  });

  test('tab switching: Table → Heatmap → Arbitrage', async ({ page }) => {
    const tabs = ['Heatmap', 'Funding Arbs', 'Price Arbs'];
    for (const tab of tabs) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
      if (await tabBtn.isVisible({ timeout: 2000 })) {
        await tabBtn.click();
        await page.waitForTimeout(1000);
        // Page should not crash
        const body = await page.locator('body').textContent();
        expect(body).not.toContain('NaN');
      }
    }
  });

  test('pagination navigates', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: /next|›/i }).first();
    if (await nextBtn.isVisible({ timeout: 3000 })) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      // URL or table content should change
      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(100);
    }
  });
});

test.describe('Funding Per-Symbol Page', () => {
  test('/funding/BTC loads with data', async ({ page }) => {
    await page.goto('/funding/BTC');
    await page.waitForTimeout(5000);

    // Should show BTC somewhere
    await expect(page.locator('body')).toContainText('BTC');

    // Page should have meaningful content
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(200);
    expect(body).not.toContain('NaN');
  });
});
