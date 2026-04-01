import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'https://info-hub.io';

test.describe('Funding API', () => {
  test('GET /api/funding returns data with symbols', async ({ request }) => {
    const res = await request.get(`${BASE}/api/funding`);
    expect(res.ok()).toBe(true);

    const json = await res.json();
    // API returns { data: [...] } wrapper
    const data = Array.isArray(json) ? json : json.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const item = data[0];
    expect(item).toHaveProperty('symbol');
    expect(typeof item.symbol).toBe('string');
  });

  test('GET /api/openinterest returns data', async ({ request }) => {
    const res = await request.get(`${BASE}/api/openinterest`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(typeof data === 'object').toBe(true);
  });

  test('GET /api/tickers returns OK', async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickers`);
    expect(res.ok()).toBe(true);
  });

  test('GET /api/spreads/current returns OK', async ({ request }) => {
    const res = await request.get(`${BASE}/api/spreads/current`);
    expect(res.ok()).toBe(true);
  });

  test('GET /api/spreads/opportunities returns OK', async ({ request }) => {
    const res = await request.get(`${BASE}/api/spreads/opportunities`);
    expect(res.ok()).toBe(true);
  });

  test('GET /api/health returns status (may require auth)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    // Health endpoint may be auth-gated (401) in production — that's OK
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Funding Rate Plausibility', () => {
  test('all funding rates are within -5% to +5% range', async ({ request }) => {
    const res = await request.get(`${BASE}/api/funding`);
    const json = await res.json();
    const data = Array.isArray(json) ? json : json.data;

    expect(Array.isArray(data)).toBe(true);

    for (const item of data.slice(0, 50)) {
      // Each item has fundingRate as a direct number
      if (typeof item.fundingRate === 'number') {
        expect(
          Math.abs(item.fundingRate),
          `${item.symbol} on ${item.exchange}: rate ${item.fundingRate} out of plausible range`,
        ).toBeLessThan(5);
      }
    }
  });
});
