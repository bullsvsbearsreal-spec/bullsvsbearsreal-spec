import { test, expect } from '@playwright/test';

/**
 * Smoke-test every public page: loads without 5xx, no NaN in content,
 * no critical console errors.
 */
const PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/funding', name: 'Funding' },
  { path: '/open-interest', name: 'Open Interest' },
  { path: '/liquidations', name: 'Liquidations' },
  { path: '/spreads', name: 'Spreads' },
  { path: '/spread-scanner', name: 'Spread Scanner' },
  { path: '/basis', name: 'Basis' },
  { path: '/top-movers', name: 'Top Movers' },
  { path: '/longshort', name: 'Long/Short' },
  { path: '/options', name: 'Options' },
  { path: '/orderflow', name: 'Orderflow' },
  { path: '/cvd', name: 'CVD' },
  { path: '/execution-costs', name: 'Execution Costs' },
  { path: '/chart', name: 'Chart' },
  { path: '/funding-heatmap', name: 'Funding Heatmap' },
  { path: '/oi-heatmap', name: 'OI Heatmap' },
  { path: '/liquidation-heatmap', name: 'Liq Heatmap' },
  { path: '/liquidation-map', name: 'Liq Map' },
  { path: '/market-heatmap', name: 'Market Heatmap' },
  { path: '/stock-heatmap', name: 'Stock Heatmap' },
  { path: '/rsi-heatmap', name: 'RSI Heatmap' },
  { path: '/correlation', name: 'Correlation' },
  { path: '/compare', name: 'Compare' },
  { path: '/market-cycle', name: 'Market Cycle' },
  { path: '/fear-greed', name: 'Fear & Greed' },
  { path: '/dominance', name: 'Dominance' },
  { path: '/onchain', name: 'On-chain' },
  { path: '/stablecoin-flows', name: 'Stablecoin Flows' },
  { path: '/exchange-reserves', name: 'Exchange Reserves' },
  { path: '/bitcoin-treasuries', name: 'BTC Treasuries' },
  { path: '/etf', name: 'ETF' },
  { path: '/economic-calendar', name: 'Economic Calendar' },
  { path: '/yields', name: 'Yields' },
  { path: '/token-unlocks', name: 'Token Unlocks' },
  { path: '/hl-whales', name: 'HL Whales' },
  { path: '/whale-alert', name: 'Whale Alert' },
  { path: '/screener', name: 'Screener' },
  { path: '/alerts', name: 'Alerts' },
  { path: '/news', name: 'News' },
  { path: '/prediction-markets', name: 'Prediction Markets' },
  { path: '/exchange-comparison', name: 'Exchange Comparison' },
  { path: '/faq', name: 'FAQ' },
  { path: '/terms', name: 'Terms' },
  { path: '/privacy', name: 'Privacy' },
  { path: '/brand', name: 'Brand' },
  { path: '/team', name: 'Team' },
  { path: '/developers', name: 'Developers' },
  { path: '/guides/funding-rate-arbitrage', name: 'Funding Arb Guide' },
];

for (const { path, name } of PAGES) {
  test(`${name} (${path}) — loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    expect(response?.status()).toBeLessThan(500);

    await page.waitForTimeout(2000);

    // No NaN in visible content
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('NaN');

    // No critical console errors (filter known non-critical ones)
    const critical = errors.filter(
      e =>
        !e.includes('hydration') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Loading chunk') &&
        !e.includes('Content Security Policy') &&
        !e.includes('cloudflareinsights') &&
        !e.includes('beacon.min.js') &&
        !e.includes('ERR_BLOCKED_BY_CSP') &&
        !e.includes('net::ERR') &&
        !e.includes('Failed to load resource') &&
        !e.includes('Refused to load'),
    );
    expect(critical, `Console errors on ${path}`).toHaveLength(0);
  });
}

test('404 page renders for unknown route', async ({ page }) => {
  const response = await page.goto('/this-does-not-exist-xyz');
  expect(response?.status()).toBe(404);
  await expect(page.locator('body')).toContainText(/not found|404/i);
});
