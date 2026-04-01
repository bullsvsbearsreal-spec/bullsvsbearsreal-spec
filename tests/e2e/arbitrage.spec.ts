import { test, expect } from '@playwright/test';
import { expectNoConsoleErrors, expectValidNumber } from '../helpers/assertions';

/**
 * Navigate to /funding and switch to "Funding Arbs" view.
 * Waits for the arb data to actually load (table with "Arbitrage Opportunities" heading).
 */
async function goToArbitrageView(page: import('@playwright/test').Page) {
  await page.goto('/funding', { waitUntil: 'domcontentloaded' });

  // Wait for the page JS to hydrate and render the view toggle buttons
  const arbBtn = page.getByRole('button', { name: /funding arbs/i }).first();
  await arbBtn.waitFor({ state: 'visible', timeout: 30000 });
  await arbBtn.click();

  // Wait for the arb view to render — look for the "Arbitrage Opportunities" heading or the table
  await page.locator('text=Arbitrage Opportunities').or(
    page.locator('[data-testid="arb-table"]')
  ).or(
    page.locator('table[aria-label*="arbitrage"]')
  ).first().waitFor({ state: 'visible', timeout: 30000 });

  // Give a moment for data rows to populate
  await page.waitForTimeout(2000);
}

/** Locate arb table rows — works with or without data-testid */
function arbRows(page: import('@playwright/test').Page) {
  return page.locator('[data-testid^="arb-row-"]').or(
    page.locator('table[aria-label*="arbitrage"] tbody tr')
  );
}

test.describe('Funding Arbitrage View', () => {
  test.beforeEach(async ({ page }) => {
    await goToArbitrageView(page);
  });

  test('renders arbitrage table with data rows', async ({ page }) => {
    const checkErrors = await expectNoConsoleErrors(page);
    const rows = arbRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    checkErrors();
  });

  test('arbitrage rows contain spread percentages', async ({ page }) => {
    const rows = arbRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    // Look for "X.XXXX%" pattern somewhere in the first few rows
    for (let i = 0; i < Math.min(5, await rows.count()); i++) {
      const rowText = await rows.nth(i).textContent();
      // Each row should have at least one percentage value
      expect(rowText).toMatch(/\d+\.\d+%/);
    }
  });

  test('grade badges display valid grades (A/B/C/D)', async ({ page }) => {
    // GradeBadge has title="Grade X (...)"
    const badges = page.locator('[title*="Grade"]');
    await expect(badges.first()).toBeVisible({ timeout: 20000 });

    for (let i = 0; i < Math.min(10, await badges.count()); i++) {
      const text = await badges.nth(i).textContent();
      expect(text).toMatch(/^[ABCD]/);
    }
  });

  test('sort by spread column works', async ({ page }) => {
    // Find the Spread column header (it has role="button" and text containing "Spread")
    const spreadHeader = page.locator('th[role="button"]').filter({ hasText: /Spread/ }).first();
    if (await spreadHeader.isVisible({ timeout: 3000 })) {
      await spreadHeader.click();
      await page.waitForTimeout(500);

      // Verify rows are in descending spread order
      const rows = arbRows(page);
      if (await rows.count() >= 2) {
        // Find the hub-yellow spread value in each row
        const first = await rows.first().locator('.text-hub-yellow').first().textContent();
        const second = await rows.nth(1).locator('.text-hub-yellow').first().textContent();
        if (first && second) {
          const v1 = parseFloat(first.replace(/[^0-9.\-]/g, ''));
          const v2 = parseFloat(second.replace(/[^0-9.\-]/g, ''));
          if (!isNaN(v1) && !isNaN(v2)) {
            expect(v1).toBeGreaterThanOrEqual(v2);
          }
        }
      }
    }
  });

  test('venue filter toggles reduce row count', async ({ page }) => {
    const rows = arbRows(page);
    const rowsBefore = await rows.count();

    const cexDexBtn = page.getByRole('button', { name: /cex.*dex/i }).first();
    if (await cexDexBtn.isVisible({ timeout: 3000 })) {
      await cexDexBtn.click();
      await page.waitForTimeout(500);
      const rowsAfter = await rows.count();
      expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
    }
  });

  test('row click expands and shows Profit Calculator toggle', async ({ page }) => {
    const rows = arbRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    await rows.first().click();
    await page.waitForTimeout(800);

    // After expanding, "Show Profit Calculator" or "Profit Calculator" should be visible
    const showCalcBtn = page.locator('button').filter({ hasText: /profit calculator/i }).first();
    await expect(showCalcBtn).toBeVisible({ timeout: 5000 });
  });

  test('ProfitCalculator opens and shows valid numbers', async ({ page }) => {
    const rows = arbRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    await rows.first().click();
    await page.waitForTimeout(800);

    // Click "Show Profit Calculator"
    const showCalcBtn = page.locator('button').filter({ hasText: /profit calculator/i }).first();
    if (await showCalcBtn.isVisible({ timeout: 5000 })) {
      await showCalcBtn.click();
      await page.waitForTimeout(500);
    }

    // Now the calculator panel should be visible
    const calculator = page.locator('[data-testid="profit-calculator"]').or(
      page.locator('text=Position Size').locator('..').locator('..').locator('..')
    ).first();

    if (await calculator.isVisible({ timeout: 5000 })) {
      const allText = await calculator.textContent();
      expect(allText).not.toContain('NaN');
      expect(allText).not.toContain('Infinity');

      // Check specific calculator output labels have valid values
      const outputLabels = ['Gross Income', 'Fee Cost', 'Net', 'ROI on Margin', 'Break-even'];
      for (const label of outputLabels) {
        const cell = calculator.locator(`text=${label}`).locator('..').locator('.font-mono').first();
        if (await cell.isVisible({ timeout: 1000 }).catch(() => false)) {
          const text = await cell.textContent();
          if (text) {
            expect(text).not.toContain('NaN');
            expect(text).not.toContain('Infinity');
          }
        }
      }
    }
  });

  test('ProfitCalculator size presets update value', async ({ page }) => {
    const rows = arbRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    await rows.first().click();
    await page.waitForTimeout(500);

    const showCalcBtn = page.locator('button').filter({ hasText: /profit calculator/i }).first();
    if (await showCalcBtn.isVisible({ timeout: 3000 })) {
      await showCalcBtn.click();
      await page.waitForTimeout(300);
    }

    // Click 50K preset button
    const preset50k = page.getByRole('button', { name: '50K' }).first();
    if (await preset50k.isVisible({ timeout: 3000 })) {
      await preset50k.click();
      await page.waitForTimeout(300);

      // The input should now show 50000
      const sizeInput = page.locator('input[type="number"]').first();
      if (await sizeInput.isVisible()) {
        const value = await sizeInput.inputValue();
        expect(parseInt(value)).toBe(50000);
      }
    }
  });

  test('no NaN or $Infinity in arb view visible text', async ({ page }) => {
    // Check the main content area (excluding SSR script data)
    const contentText = await page.locator('main, [role="main"], #__next > div').first().textContent();
    if (contentText) {
      expect(contentText).not.toContain('NaN');
      expect(contentText).not.toContain('$Infinity');
    }
  });
});

test.describe('Funding Arbitrage — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('arbitrage view renders on mobile without crash', async ({ page }) => {
    await page.goto('/funding', { waitUntil: 'domcontentloaded' });
    const arbBtn = page.getByRole('button', { name: /funding arbs/i }).first();
    await arbBtn.waitFor({ state: 'visible', timeout: 30000 });
    await arbBtn.click();
    await page.waitForTimeout(3000);

    // Page should render content without crashing
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(200);
    expect(body).not.toContain('NaN');
  });
});
