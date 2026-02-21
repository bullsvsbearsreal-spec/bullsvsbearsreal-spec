import { test, expect } from '@playwright/test';

// ─── Funding API ──────────────────────────────────────────────
test.describe('Funding API', () => {
  test('returns valid funding data with meta', async ({ request }) => {
    const res = await request.get('/api/funding');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBeTruthy();
    expect(json.data.length).toBeGreaterThan(100);
    expect(json.meta).toBeDefined();
    expect(json.meta.totalExchanges).toBeGreaterThan(15);
    expect(json.meta.normalization).toBeDefined();
  });

  test('each entry has required fields', async ({ request }) => {
    const res = await request.get('/api/funding');
    const json = await res.json();
    const sample = json.data.slice(0, 20);
    for (const entry of sample) {
      expect(entry.symbol).toBeTruthy();
      expect(entry.exchange).toBeTruthy();
      expect(typeof entry.fundingRate).toBe('number');
      expect(['1h', '4h', '8h']).toContain(entry.fundingInterval);
      expect(['cex', 'dex']).toContain(entry.type);
    }
  });

  test('no XBT symbols (normalized to BTC)', async ({ request }) => {
    const res = await request.get('/api/funding');
    const json = await res.json();
    const xbt = json.data.filter((d: any) => d.symbol === 'XBT');
    expect(xbt.length).toBe(0);
  });

  test('has both CEX and DEX entries', async ({ request }) => {
    const res = await request.get('/api/funding');
    const json = await res.json();
    const cex = json.data.filter((d: any) => d.type === 'cex');
    const dex = json.data.filter((d: any) => d.type === 'dex');
    expect(cex.length).toBeGreaterThan(50);
    expect(dex.length).toBeGreaterThan(10);
  });

  test('BTC has entries from multiple exchanges', async ({ request }) => {
    const res = await request.get('/api/funding');
    const json = await res.json();
    const btc = json.data.filter((d: any) => d.symbol === 'BTC');
    expect(btc.length).toBeGreaterThan(10);
    const exchanges = new Set(btc.map((d: any) => d.exchange));
    expect(exchanges.size).toBeGreaterThan(8);
  });

  test('health array has exchange statuses', async ({ request }) => {
    const res = await request.get('/api/funding');
    const json = await res.json();
    expect(Array.isArray(json.health)).toBeTruthy();
    expect(json.health.length).toBeGreaterThan(15);
    const first = json.health[0];
    expect(first.name).toBeTruthy();
    expect(first.status).toBe('ok');
    expect(typeof first.count).toBe('number');
  });
});

// ─── Tickers API ──────────────────────────────────────────────
test.describe('Tickers API', () => {
  test('returns valid ticker data', async ({ request }) => {
    const res = await request.get('/api/tickers');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBeTruthy();
    expect(json.data.length).toBeGreaterThan(100);
  });

  test('each entry has price and exchange', async ({ request }) => {
    const res = await request.get('/api/tickers');
    const json = await res.json();
    for (const t of json.data.slice(0, 20)) {
      expect(t.symbol).toBeTruthy();
      expect(t.exchange).toBeTruthy();
      expect(typeof t.lastPrice).toBe('number');
      expect(t.lastPrice).toBeGreaterThan(0);
    }
  });

  test('no XBT symbols', async ({ request }) => {
    const res = await request.get('/api/tickers');
    const json = await res.json();
    const xbt = json.data.filter((t: any) => t.symbol === 'XBT');
    expect(xbt.length).toBe(0);
  });
});

// ─── Open Interest API ────────────────────────────────────────
test.describe('Open Interest API', () => {
  test('returns valid OI data', async ({ request }) => {
    const res = await request.get('/api/openinterest');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBeTruthy();
    expect(json.data.length).toBeGreaterThan(100);
  });

  test('each entry has OI value', async ({ request }) => {
    const res = await request.get('/api/openinterest');
    const json = await res.json();
    for (const entry of json.data.slice(0, 20)) {
      expect(entry.symbol).toBeTruthy();
      expect(entry.exchange).toBeTruthy();
      expect(typeof entry.openInterestValue).toBe('number');
      expect(entry.openInterestValue).toBeGreaterThan(0);
    }
  });

  test('total OI is reasonable (>$30B)', async ({ request }) => {
    const res = await request.get('/api/openinterest');
    const json = await res.json();
    const total = json.data.reduce((sum: number, e: any) => sum + (e.openInterestValue || 0), 0);
    expect(total).toBeGreaterThan(30_000_000_000);
  });
});

// ─── Prediction Markets API ───────────────────────────────────
test.describe('Prediction Markets API', () => {
  test('returns markets from Polymarket and Kalshi', async ({ request }) => {
    const res = await request.get('/api/prediction-markets');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.markets).toBeDefined();
    expect(json.markets.polymarket).toBeDefined();
    expect(json.markets.kalshi).toBeDefined();
    expect(json.markets.polymarket.length).toBeGreaterThan(10);
    expect(json.markets.kalshi.length).toBeGreaterThan(10);
  });

  test('market entries have required fields', async ({ request }) => {
    const res = await request.get('/api/prediction-markets');
    const json = await res.json();
    const poly = json.markets.polymarket[0];
    expect(poly.question).toBeTruthy();
    expect(poly.yesPrice).toBeGreaterThanOrEqual(0);
    expect(poly.yesPrice).toBeLessThanOrEqual(1);
    expect(poly.platform).toBe('polymarket');
    expect(poly.url).toContain('polymarket.com');
  });

  test('meta has counts and timestamp', async ({ request }) => {
    const res = await request.get('/api/prediction-markets');
    const json = await res.json();
    expect(json.meta.counts.polymarket).toBeGreaterThan(0);
    expect(json.meta.counts.kalshi).toBeGreaterThan(0);
    expect(json.meta.timestamp).toBeGreaterThan(0);
  });
});

// ─── Fear & Greed API ─────────────────────────────────────────
test.describe('Fear & Greed API', () => {
  test('returns valid index data', async ({ request }) => {
    const res = await request.get('/api/fear-greed');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(typeof json.value).toBe('number');
    expect(json.value).toBeGreaterThanOrEqual(0);
    expect(json.value).toBeLessThanOrEqual(100);
    expect(json.classification).toBeTruthy();
  });
});

// ─── Health API ───────────────────────────────────────────────
test.describe('Health API', () => {
  test('returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });
});

// ─── Liquidations API ─────────────────────────────────────────
test.describe('Liquidations API', () => {
  test('requires symbol parameter', async ({ request }) => {
    const res = await request.get('/api/liquidations');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('symbol');
  });
});

// ─── Long/Short API ──────────────────────────────────────────
test.describe('Long/Short API', () => {
  test('returns ratio data', async ({ request }) => {
    const res = await request.get('/api/longshort');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(typeof json.longRatio).toBe('number');
    expect(typeof json.shortRatio).toBe('number');
    expect(json.longRatio + json.shortRatio).toBeCloseTo(100, 0);
  });
});

// ─── Options API ──────────────────────────────────────────────
test.describe('Options API', () => {
  test('returns options data', async ({ request }) => {
    const res = await request.get('/api/options');
    expect(res.ok()).toBeTruthy();
  });
});
