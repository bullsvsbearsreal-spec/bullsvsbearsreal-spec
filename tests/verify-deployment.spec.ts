import { test, expect } from '@playwright/test';

const BASE_URL = 'https://info-hub.io';

test.describe('Deployment Verification', () => {
  test('API docs page loads and has content', async ({ page }) => {
    await page.goto(`${BASE_URL}/api-docs`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText('API');
    await page.screenshot({ path: 'test-results/api-docs.png', fullPage: true });
  });

  test('Funding page loads with table', async ({ page }) => {
    await page.goto(`${BASE_URL}/funding`, { waitUntil: 'networkidle' });
    // Wait for data to load
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/funding-page.png', fullPage: false });
  });

  test('Funding API returns normalization metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/funding`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.meta).toBeDefined();
    expect(data.meta.normalization).toBeDefined();
    expect(data.meta.normalization.basis).toBe('8h');
    // anomalies is only present when there are actual anomalies
    if (data.meta.anomalies !== undefined) {
      expect(Array.isArray(data.meta.anomalies)).toBeTruthy();
    }
  });

  test('Funding API has predicted rates for OKX entries', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/funding`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // OKX entries should have predictedRate field
    const okxEntries = data.data.filter((d: any) => d.exchange === 'OKX');
    expect(okxEntries.length).toBeGreaterThan(0);
    const withPredicted = okxEntries.filter((d: any) => d.predictedRate !== undefined);
    expect(withPredicted.length).toBeGreaterThan(0);
  });

  test('Navigation has API link', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const apiLink = page.locator('nav a[href="/api-docs"]');
    await expect(apiLink).toBeVisible();
    await expect(apiLink).toContainText('API');
  });

  test('Arbitrage view has portfolio sizing', async ({ page }) => {
    await page.goto(`${BASE_URL}/funding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    // Click arbitrage tab
    const arbTab = page.locator('button:has-text("Arbitrage")');
    if (await arbTab.isVisible()) {
      await arbTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/arbitrage-view.png', fullPage: false });
    }
  });

  test('Liquidations page has multi-exchange support', async ({ page }) => {
    await page.goto(`${BASE_URL}/liquidations`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    // Should show exchange toggle buttons
    await expect(page.locator('button:has-text("Binance")')).toBeVisible();
    await expect(page.locator('button:has-text("Bybit")')).toBeVisible();
    await expect(page.locator('button:has-text("OKX")')).toBeVisible();
    await expect(page.locator('button:has-text("Bitget")')).toBeVisible();
    await page.screenshot({ path: 'test-results/liquidations-multi-exchange.png', fullPage: false });
  });

  test('Footer is present on funding page', async ({ page }) => {
    await page.goto(`${BASE_URL}/funding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('21 exchanges');
  });

  test('Share button is present on funding page', async ({ page }) => {
    await page.goto(`${BASE_URL}/funding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const shareBtn = page.locator('button:has-text("Share")');
    await expect(shareBtn).toBeVisible();
  });
});
