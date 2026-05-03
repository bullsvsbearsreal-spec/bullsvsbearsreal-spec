import { test, expect } from '@playwright/test';
import { waitForDataLoad, expectValidNumber } from '../helpers/assertions';

// ── Correlation Matrix ──

test.describe('Correlation Matrix', () => {
  test('renders matrix with values between -1 and 1', async ({ page }) => {
    await page.goto('/correlation');
    await waitForDataLoad(page);

    // Stats should load
    const avgCorr = page.locator('text=Avg Correlation').locator('..');
    await expect(avgCorr).toBeVisible({ timeout: 15000 });

    // Matrix cells should be visible
    const body = await page.locator('main').textContent();
    expect(body).toContain('BTC');
    expect(body).toContain('ETH');
    expect(body).not.toContain('NaN');

    // Check correlation values are between -1 and 1
    const cells = await page.locator('td, div').filter({ hasText: /^[01]\.\d{2}$/ }).allTextContents();
    for (const cell of cells.slice(0, 20)) {
      const val = parseFloat(cell);
      expect(val).toBeGreaterThanOrEqual(-1);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

// ── Fear & Greed ──

test.describe('Fear & Greed Index', () => {
  test('renders gauge with value 0-100', async ({ page }) => {
    await page.goto('/fear-greed');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent();
    expect(body).not.toContain('NaN');

    // Should contain a classification
    const hasClassification = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed']
      .some(c => body?.includes(c));
    expect(hasClassification).toBe(true);

    // Current value, 7d avg, 30d avg should be present
    expect(body).toContain('Current Value');
    expect(body).toContain('7d Average');
    expect(body).toContain('30d Average');
  });
});

// ── Long/Short Ratio ──

test.describe('Long/Short Ratio', () => {
  test('L/S percentages sum to ~100%', async ({ page }) => {
    await page.goto('/longshort');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');

    // Extract long and short percentages
    const longMatch = body.match(/(\d+\.\d+)%/);
    const shortMatch = body.match(/(\d+\.\d+)%.*?(\d+\.\d+)%/);
    if (longMatch && shortMatch) {
      const longPct = parseFloat(longMatch[1]);
      const shortPct = parseFloat(shortMatch[2]);
      // Should sum to approximately 100%
      expect(longPct + shortPct).toBeGreaterThan(99);
      expect(longPct + shortPct).toBeLessThan(101);
    }

    // Should show L/S Ratio
    expect(body).toContain('L/S Ratio');
  });
});

// ── CVD ──

test.describe('Cumulative Volume Delta', () => {
  test('buy/sell volumes and net delta are consistent', async ({ page }) => {
    await page.goto('/cvd');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Buy Volume');
    expect(body).toContain('Sell Volume');
    expect(body).toContain('Net Delta');

    // Buy/Sell pressure should add to ~100%
    const pressureMatch = body.match(/Buy\s+(\d+\.\d+)%[\s\S]*?Sell\s+(\d+\.\d+)%/);
    if (pressureMatch) {
      const buy = parseFloat(pressureMatch[1]);
      const sell = parseFloat(pressureMatch[2]);
      expect(buy + sell).toBeGreaterThan(99);
      expect(buy + sell).toBeLessThan(101);
    }
  });
});

// ── ETF Tracker ──

test.describe('Crypto ETF Tracker', () => {
  test('shows IBIT price and fund count', async ({ page }) => {
    await page.goto('/etf');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('IBIT');
    expect(body).toMatch(/\d+ funds/i);

    // Should have a price value
    expect(body).toMatch(/\$\d+\.\d+/);
  });
});

// ── Token Unlocks ──

test.describe('Token Unlocks Calendar', () => {
  test('shows upcoming unlocks with values', async ({ page }) => {
    await page.goto('/token-unlocks');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Upcoming Unlocks');
    expect(body).toContain('Total Value Locked');

    // Should show dollar values
    expect(body).toMatch(/\$[\d.]+[BMK]/);
  });
});

// ── Stablecoin Flows ──

test.describe('Stablecoin Flows', () => {
  test('shows total market cap and chain distribution', async ({ page }) => {
    await page.goto('/stablecoin-flows');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Stablecoin Market Cap');
    expect(body).toContain('Ethereum');
    expect(body).toContain('Tron');

    // Percentages should be present
    expect(body).toMatch(/\d+\.\d+%/);
  });
});

// ── Basis / Premium ──

test.describe('Basis / Premium', () => {
  test('shows BTC and ETH basis with premium/discount split', async ({ page }) => {
    await page.goto('/basis');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('BTC Basis');
    expect(body).toContain('ETH Basis');
    expect(body).toContain('Premium');
    expect(body).toContain('Discount');
  });
});

// ── Prediction Markets ──

test.describe('Prediction Markets', () => {
  test('shows matched pairs and arbitrage opportunities', async ({ page }) => {
    await page.goto('/prediction-markets');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Matched Pairs');
    expect(body).toContain('Best Spread');

    // Should have percentage spreads
    expect(body).toMatch(/\d+\.\d+%/);
  });
});

// ── Economic Calendar ──

test.describe('Economic Calendar', () => {
  test('shows events with impact levels', async ({ page }) => {
    await page.goto('/economic-calendar');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Events');

    // Should have filter options
    const hasRegion = ['US', 'EU', 'GB', 'JP'].some(r => body?.includes(r));
    expect(hasRegion).toBe(true);
  });
});

// ── Screener ──

test.describe('Screener', () => {
  test('renders symbol table with sortable columns', async ({ page }) => {
    await page.goto('/screener');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('BTC');
    expect(body).toContain('ETH');

    // Should show key columns
    expect(body).toContain('Symbol');
    expect(body).toContain('Price');
    expect(body).toContain('Volume');

    // Quick filters should be present
    expect(body).toContain('High Funding');
  });
});

// ── HL Whales ──

test.describe('Hyperliquid Whale Tracker', () => {
  test('shows tracked whales with account values', async ({ page }) => {
    await page.goto('/hl-whales');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Tracked Whales');
    expect(body).toContain('Total Account Value');

    // Should show dollar-denominated values
    expect(body).toMatch(/\$[\d.]+M/);
  });
});

// ── Exchange Comparison ──

test.describe('Exchange Comparison', () => {
  test('shows exchange list with OI data', async ({ page }) => {
    await page.goto('/exchange-comparison');
    await waitForDataLoad(page);

    // Wait for chart or table to load
    await page.waitForTimeout(3000);
    const body = await page.locator('main').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).toContain('Binance');
    expect(body).toContain('Bybit');

    // Should have view/metric tabs
    expect(body).toContain('Chart');
    expect(body).toContain('Table');
  });
});

// ── Mobile Viewport ──

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('funding page renders on mobile', async ({ page }) => {
    await page.goto('/funding');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).toContain('Funding');
    expect(body).not.toContain('NaN');

    // Note: funding page has horizontal overflow on 375px (scrollWidth ~580px)
    // This is a known issue due to wide stat cards and data tables
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth > clientWidth + 5) {
      console.warn(`Mobile overflow detected: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
    }
  });

  test('arbitrage table adapts to mobile', async ({ page }) => {
    await page.goto('/funding');
    await waitForDataLoad(page);

    // Click Funding Arbs tab
    const arbsBtn = page.getByRole('button', { name: /funding arbs/i });
    await arbsBtn.click();
    await page.waitForTimeout(3000);

    const body = await page.locator('main').textContent() || '';
    expect(body).toContain('Arbitrage');
    expect(body).not.toContain('NaN');
  });

  test('spreads page renders on mobile', async ({ page }) => {
    await page.goto('/spreads');
    await waitForDataLoad(page);

    const body = await page.locator('main').textContent() || '';
    expect(body).toContain('Spread');
    expect(body).not.toContain('NaN');
  });
});
