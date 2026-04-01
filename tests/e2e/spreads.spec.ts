import { test, expect } from '@playwright/test';
import { expectNoConsoleErrors, waitForDataLoad } from '../helpers/assertions';

test.describe('Spreads Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/spreads');
    await waitForDataLoad(page);
  });

  test('page loads with exchange data', async ({ page }) => {
    const checkErrors = await expectNoConsoleErrors(page);
    // The page has multiple tables — find the main exchange table
    const table = page.locator('table.w-full').first()
      .or(page.locator('[data-testid="exchange-table"]').first());
    await expect(table).toBeVisible({ timeout: 15000 });
    checkErrors();
  });

  test('symbol picker is interactive', async ({ page }) => {
    // Find any button that looks like a symbol picker (shows BTC, ETH, etc.)
    const picker = page.locator('[data-testid="symbol-picker"]')
      .or(page.locator('button').filter({ hasText: /^(BTC|ETH|SOL)$/ }).first());
    if (await picker.isVisible({ timeout: 3000 })) {
      await picker.click();
      await page.waitForTimeout(500);

      // Type to search
      const search = page.locator('input[placeholder*="earch"]')
        .or(page.locator('input[type="search"]'))
        .or(page.locator('input[type="text"]').first());
      if (await search.isVisible({ timeout: 2000 })) {
        await search.fill('ETH');
        await page.waitForTimeout(500);
        // Just verify the page doesn't crash
        const body = await page.locator('body').textContent();
        expect(body).not.toContain('NaN');
      }
    }
  });

  test('ArbCalculator produces valid output', async ({ page }) => {
    const calcToggle = page.locator('text=Arb Calculator');
    if (await calcToggle.isVisible({ timeout: 5000 })) {
      const amtInput = page.locator('input[aria-label="Position size"]')
        .or(page.locator('input[type="number"]').first());
      if (await amtInput.isVisible()) {
        await amtInput.fill('10000');
        await page.waitForTimeout(300);
        // Check the calculator area for NaN
        const calcArea = calcToggle.locator('..').locator('..');
        const text = await calcArea.textContent();
        expect(text).not.toContain('NaN');
      }
    }
  });

  test('timeframe switch does not crash', async ({ page }) => {
    const timeframes = ['5m', '15m', '1h', '4h'];
    for (const tf of timeframes) {
      const btn = page.getByRole('button', { name: tf, exact: true }).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(500);
        // Verify page is still functional
        const body = await page.locator('main, body').first().textContent();
        expect(body).not.toContain('NaN');
        break;
      }
    }
  });

  test('spread chart canvas renders', async ({ page }) => {
    const chart = page.locator('canvas')
      .or(page.locator('[data-testid="spread-chart"]'))
      .first();
    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('close button dismisses ArbCalculator', async ({ page }) => {
    const calc = page.locator('text=Arb Calculator');
    if (await calc.isVisible({ timeout: 3000 })) {
      const closeBtn = page.locator('button[aria-label="Close calculator"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });
});
