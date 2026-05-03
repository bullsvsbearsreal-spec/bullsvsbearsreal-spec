export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const AGGREGATOR_URL = 'https://prices.info-hub.io';

type Candle = { t: number; o: number; h: number; l: number; c: number };

const cache = new Map<string, { data: any; ts: number }>();

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawSymbol = (sp.get('symbol') || 'BTC').toUpperCase();
  const symbol = /^[A-Z0-9]+$/.test(rawSymbol) ? rawSymbol : 'BTC';
  const VALID_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  const rawInterval = sp.get('interval') || '1h';
  const interval = VALID_INTERVALS.includes(rawInterval) ? rawInterval : '1h';
  const limit = Number(sp.get('limit')) || (interval === '1h' ? 168 : interval === '4h' ? 180 : 90);

  const key = `${symbol}-${interval}-${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < 60_000) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } });
  }

  try {
    const r = await fetch(
      `${AGGREGATOR_URL}/klines-multi?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!r.ok) {
      return NextResponse.json(
        { symbol, interval, limit, exchanges: {}, meta: { requested: 0, success: 0, ts: Date.now(), error: 'Aggregator unavailable' } },
        { status: 502 }
      );
    }

    const data = await r.json();

    // Three-layer outlier filtering: deviation, staleness, and flat-line.
    //   1. Deviation: latest close > 1% from median while ALSO being stale → drop
    //   2. Staleness: most recent candle older than 1.5x the interval → drop
    //   3. Flat-line: entire returned time-series range < 0.05% of median → drop
    //      (catches stuck/cached feeds that return the same value repeatedly)
    const rawExchanges: Record<string, Candle[]> = data.exchanges || {};
    const now = Date.now();
    // Interval ms × 1.5 — 1h interval allows 1.5h, 4h allows 6h, 1d allows 36h
    const intervalMs =
      interval === '1m' ? 60_000 :
      interval === '5m' ? 300_000 :
      interval === '15m' ? 900_000 :
      interval === '1h' ? 3_600_000 :
      interval === '4h' ? 14_400_000 :
      interval === '1d' ? 86_400_000 :
      interval === '1w' ? 604_800_000 :
      3_600_000;
    const staleThreshold = intervalMs * 1.5;

    const lastPrices = Object.entries(rawExchanges)
      .map(([ex, candles]) => {
        const last = candles[candles.length - 1];
        return { ex, price: last?.c || 0, ts: last?.t || 0 };
      })
      .filter(x => x.price > 0)
      .sort((a, b) => a.price - b.price);

    const filtered: Record<string, Candle[]> = {};
    let ok = 0;
    let dropped: { ex: string; reason: string }[] = [];

    if (lastPrices.length >= 3) {
      const median = lastPrices[Math.floor(lastPrices.length / 2)].price;
      const flatThreshold = Math.max(median * 0.0005, 1); // 0.05% of median

      for (const { ex, price, ts } of lastPrices) {
        const dev = Math.abs(price - median) / median;
        const ageMs = now - ts;
        const isStale = ageMs > staleThreshold;

        // Compute time-series range for this venue — flat-line detection
        const series = rawExchanges[ex];
        let lo = Infinity, hi = -Infinity, n = 0;
        for (const c of series) {
          if (typeof c?.c === 'number' && c.c > 0) {
            if (c.c < lo) lo = c.c;
            if (c.c > hi) hi = c.c;
            n++;
          }
        }
        const range = n > 1 ? hi - lo : 0;
        const isFlatLine = n >= 4 && range < flatThreshold;

        // Drop if any of: stale (>1.5x interval), or stale-AND-deviant (>1%), or flat-line
        if (isFlatLine) {
          dropped.push({ ex, reason: 'flat-line' });
          continue;
        }
        if (isStale && dev > 0.01) {
          dropped.push({ ex, reason: `stale+deviant ${(dev * 100).toFixed(2)}%` });
          continue;
        }
        if (isStale) {
          dropped.push({ ex, reason: `stale ${Math.round(ageMs / 60000)}m` });
          continue;
        }
        filtered[ex] = rawExchanges[ex];
        ok++;
      }
    } else {
      for (const [ex, candles] of Object.entries(rawExchanges)) {
        filtered[ex] = candles;
        ok++;
      }
    }

    const resp = { symbol, interval, limit, exchanges: filtered, meta: { requested: Object.keys(rawExchanges).length, success: ok, dropped, ts: Date.now() } };
    // Only cache non-empty responses to avoid caching post-restart empty data
    if (ok > 0) {
      if (cache.size > 200) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, { data: resp, ts: Date.now() });
    }
    return NextResponse.json(resp, { headers: { 'Cache-Control': ok > 0 ? 's-maxage=60, stale-while-revalidate=120' : 'no-cache' } });
  } catch {
    return NextResponse.json(
      { symbol, interval, limit, exchanges: {}, meta: { requested: 0, success: 0, ts: Date.now(), error: 'Aggregator timeout' } },
      { status: 504 }
    );
  }
}
