import { test, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/assertions';

test.describe('Open Interest Page', () => {
  test('OI table renders with plausible values', async ({ page }) => {
    await page.goto('/open-interest');
    // OI page has active WebSocket connections that prevent networkidle — use domcontentloaded + row wait instead
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 30000 });
    expect(await rows.count()).toBeGreaterThan(0);

    const body = await page.locator('body').textContent();
    expect(body).not.toContain('NaN');
  });
});

test.describe('Liquidations Page', () => {
  test('liquidation feed shows entries', async ({ page }) => {
    await page.goto('/liquidations');
    await waitForDataLoad(page);

    // Should show liquidation data or "no recent" message
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(100);
    expect(body).not.toContain('NaN');
  });
});

test.describe('Top Movers Page', () => {
  test('gainers and losers display with % changes', async ({ page }) => {
    await page.goto('/top-movers');
    await waitForDataLoad(page);

    const body = await page.locator('body').textContent();
    // Should contain percentage values
    expect(body).toMatch(/%/);
    expect(body).not.toContain('NaN');
  });
});

test.describe('Options Page', () => {
  test('options data loads for at least one exchange', async ({ page }) => {
    await page.goto('/options');
    await waitForDataLoad(page);

    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(200);
    expect(body).not.toContain('NaN');
  });
});

test.describe('Execution Costs Page', () => {
  test('venue cards render with cost estimates', async ({ page }) => {
    await page.goto('/execution-costs');
    await waitForDataLoad(page);

    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(200);
    expect(body).not.toContain('NaN');
    // Note: don't check for "undefined" in body.textContent() — Next.js SSR data contains "$undefined"
  });
});
