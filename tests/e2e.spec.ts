import { test, expect } from '@playwright/test';

// ─── Page Load Tests ──────────────────────────────────────────
// Verify every major page loads without crashing

// Pages that have a footer
const PAGES_WITH_FOOTER = [
  { path: '/', name: 'Homepage', selector: 'h1, h2' },
  { path: '/funding', name: 'Funding', selector: 'h1' },
  { path: '/open-interest', name: 'Open Interest', selector: 'h1' },
  { path: '/liquidations', name: 'Liquidations', selector: 'h1' },
  { path: '/screener', name: 'Screener', selector: 'h1' },
  { path: '/compare', name: 'Compare', selector: 'h1' },
  { path: '/news', name: 'News', selector: 'h1' },
  { path: '/fear-greed', name: 'Fear & Greed', selector: 'h1' },
  { path: '/market-heatmap', name: 'Market Heatmap', selector: 'h1' },
  { path: '/longshort', name: 'Long/Short', selector: 'h1' },
  { path: '/token-unlocks', name: 'Token Unlocks', selector: 'h1' },
  { path: '/options', name: 'Options', selector: 'h1' },
  { path: '/basis', name: 'Basis', selector: 'h1' },
  { path: '/prediction-markets', name: 'Prediction Markets', selector: 'h1' },
  { path: '/economic-calendar', name: 'Economic Calendar', selector: 'h1' },
  { path: '/funding-heatmap', name: 'Funding Heatmap', selector: 'h1' },
  { path: '/correlation', name: 'Correlation', selector: 'h1' },
  { path: '/dominance', name: 'Dominance', selector: 'h1' },
  { path: '/top-movers', name: 'Top Movers', selector: 'h1' },
  { path: '/alerts', name: 'Alerts', selector: 'h1' },
  { path: '/api-docs', name: 'API Docs', selector: 'h1' },
  { path: '/faq', name: 'FAQ', selector: 'h1' },
  { path: '/terms', name: 'Terms', selector: 'h1, h2, p' },
];

// Pages that may not have a standard footer (standalone layouts)
const PAGES_NO_FOOTER = [
  { path: '/brand', name: 'Brand', selector: 'h1' },
  { path: '/team', name: 'Team', selector: 'h1' },
];

test.describe('Page Load Smoke Tests', () => {
  for (const { path, name, selector } of PAGES_WITH_FOOTER) {
    test(`${name} (${path}) loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      expect(res?.status()).toBeLessThan(500);

      // Page should have at least a heading
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 10000 });

      // Footer should be present
      await expect(page.locator('footer')).toBeAttached();

      // No uncaught JS errors (allow known benign ones)
      const realErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Loading chunk')
      );
      expect(realErrors).toHaveLength(0);
    });
  }

  for (const { path, name, selector } of PAGES_NO_FOOTER) {
    test(`${name} (${path}) loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      expect(res?.status()).toBeLessThan(500);

      await expect(page.locator(selector).first()).toBeVisible({ timeout: 10000 });

      const realErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Loading chunk')
      );
      expect(realErrors).toHaveLength(0);
    });
  }
});

// ─── Funding Page Interactions ────────────────────────────────
test.describe('Funding Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/funding', { waitUntil: 'networkidle', timeout: 30000 });
  });

  test('shows funding rate stats', async ({ page }) => {
    await expect(page.locator('text=/AVG RATE/i')).toBeVisible();
  });

  test('period toggle switches rates', async ({ page }) => {
    // Click 1H toggle
    const btn1h = page.locator('button:has-text("1H")');
    if (await btn1h.isVisible()) {
      await btn1h.click();
      // At least one stat label should show /1H
      await expect(page.locator('text="Avg Rate /1H"').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('asset class tabs work', async ({ page }) => {
    const cryptoTab = page.locator('button:has-text("Crypto")');
    await expect(cryptoTab).toBeVisible();

    const stocksTab = page.locator('button:has-text("Stocks")');
    if (await stocksTab.isVisible()) {
      await stocksTab.click();
      await page.waitForTimeout(2000);
    }
  });

  test('heatmap view loads', async ({ page }) => {
    const heatmapTab = page.locator('button:has-text("Heatmap")');
    if (await heatmapTab.isVisible()) {
      await heatmapTab.click();
      await page.waitForTimeout(3000);
      // Should have heatmap cells
      await expect(page.locator('[class*="grid"], table').first()).toBeVisible();
    }
  });

  test('arbitrage view loads', async ({ page }) => {
    const arbTab = page.locator('button:has-text("Arbitrage")');
    if (await arbTab.isVisible()) {
      await arbTab.click();
      await page.waitForTimeout(3000);
    }
  });
});

// ─── Liquidations Page ────────────────────────────────────────
test.describe('Liquidations Page', () => {
  test('shows exchange toggles', async ({ page }) => {
    await page.goto('/liquidations', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('button:has-text("Binance")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Bybit")')).toBeVisible();
    await expect(page.locator('button:has-text("OKX")')).toBeVisible();
  });

  test('has CEX/DEX filter', async ({ page }) => {
    await page.goto('/liquidations', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'CEX', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'DEX', exact: true })).toBeVisible();
  });
});

// ─── Prediction Markets Page ──────────────────────────────────
test.describe('Prediction Markets Page', () => {
  test('shows Browse and Arbitrage tabs', async ({ page }) => {
    await page.goto('/prediction-markets', { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.locator('button:has-text("Browse")')).toBeVisible();
    await expect(page.locator('button:has-text("Arbitrage")')).toBeVisible();
  });

  test('displays market cards', async ({ page }) => {
    await page.goto('/prediction-markets', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Should have some market entries
    const cards = page.locator('[class*="border"]').filter({ hasText: /polymarket|kalshi/i });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── Footer ───────────────────────────────────────────────────
test.describe('Footer', () => {
  test('has dynamic exchange count', async ({ page }) => {
    await page.goto('/funding', { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer');
    await expect(footer).toContainText(/\d+ exchanges/);
  });

  test('has navigation links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer');
    await expect(footer.locator('a[href="/funding"]')).toBeAttached();
    await expect(footer.locator('a[href="/open-interest"]')).toBeAttached();
    await expect(footer.locator('a[href="/faq"]')).toBeAttached();
  });
});

// ─── 404 Handling ─────────────────────────────────────────────
test.describe('Error Handling', () => {
  test('nonexistent page returns 404', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist');
    expect(res?.status()).toBe(404);
  });
});
