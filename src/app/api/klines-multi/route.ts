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

    // Light outlier filtering: only exclude exchanges whose LATEST candle close
    // is >5% from median AND whose candle is stale (>2h old for 1h interval).
    // VPS data is already consistent so we use a loose threshold.
    const rawExchanges: Record<string, Candle[]> = data.exchanges || {};
    const now = Date.now();
    const staleThreshold = interval === '1d' ? 86400000 * 2 : interval === '4h' ? 14400000 * 2 : 7200000;
    const lastPrices = Object.entries(rawExchanges)
      .map(([ex, candles]) => {
        const last = candles[candles.length - 1];
        return { ex, price: last?.c || 0, ts: last?.t || 0 };
      })
      .filter(x => x.price > 0)
      .sort((a, b) => a.price - b.price);

    const filtered: Record<string, Candle[]> = {};
    let ok = 0;

    if (lastPrices.length >= 3) {
      const median = lastPrices[Math.floor(lastPrices.length / 2)].price;
      for (const { ex, price, ts } of lastPrices) {
        const dev = Math.abs(price - median) / median;
        const isStale = (now - ts) > staleThreshold;
        // Only filter if both deviant AND stale — fresh data with small deviations is normal
        if (dev < 0.05 || !isStale) {
          filtered[ex] = rawExchanges[ex];
          ok++;
        }
      }
    } else {
      for (const [ex, candles] of Object.entries(rawExchanges)) {
        filtered[ex] = candles;
        ok++;
      }
    }

    const resp = { symbol, interval, limit, exchanges: filtered, meta: { requested: Object.keys(rawExchanges).length, success: ok, ts: Date.now() } };
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
