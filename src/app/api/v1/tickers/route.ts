import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { fetchWithTimeout, normalizeSymbol } from '../../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../../_shared/exchange-fetchers';
import { dedupedFetch } from '../../_shared/inflight';
import { tickerFetchers } from '../../tickers/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1: In-memory cache (5s TTL for v1 — slightly longer than internal)
let l1Cache: { data: any[]; ts: number } | null = null;
const L1_TTL = 5_000;

/**
 * GET /api/v1/tickers
 *
 * Returns real-time price & volume data across exchanges. Per-exchange
 * rows by default; pass `aggregate=1` to collapse to one row per symbol
 * with deduped cross-venue volume.
 *
 * Query params:
 *   ?symbols=BTC,ETH        — filter by symbols (comma-separated)
 *   ?exchanges=binance,bybit — filter by exchange (comma-separated, case-insensitive)
 *   ?aggregate=1            — one row per symbol, summed volume (dedup-by-exchange)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const aggregate = searchParams.get('aggregate') === '1' || searchParams.get('aggregate') === 'true';

  // Per-entry volume cap — a single venue mis-reporting in coin units can
  // skew aggregate volume by orders of magnitude. Same value used by
  // /home and CryptoMetricsPanel.
  const MAX_SANE_VOL = 100_000_000_000;

  try {
    let rawData: any[];

    if (l1Cache && Date.now() - l1Cache.ts < L1_TTL) {
      rawData = l1Cache.data;
    } else {
      const { data } = await dedupedFetch('tickers', () =>
        fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout),
      );
      data.forEach((e: any) => { e.symbol = normalizeSymbol(e.symbol); });
      rawData = data;
      // Don't pin an empty array — a momentary "all upstreams blipped" event
      // would otherwise return [] for the next 5 s instead of retrying.
      if (rawData.length > 0) l1Cache = { data: rawData, ts: Date.now() };
    }

    let filtered = rawData;
    if (symbolFilter?.length) {
      const set = new Set(symbolFilter);
      filtered = filtered.filter((d: any) => set.has(d.symbol?.toUpperCase()));
    }
    if (exchangeFilter?.length) {
      const set = new Set(exchangeFilter);
      filtered = filtered.filter((d: any) => set.has(d.exchange?.toLowerCase()));
    }

    if (aggregate) {
      // One row per symbol. Volume: dedupe by exchange (some exchanges
      // report multiple pairs for the same symbol) and sum the max per
      // exchange — this matches CryptoMetricsPanel's logic so the
      // numbers stay consistent across surfaces.
      type AggTicker = {
        symbol: string;
        lastPrice: number | null;
        high24h: number | null;
        low24h: number | null;
        volume24h: number;
        priceChange24hPct: number | null;
        venueCount: number;
      };
      const bySymbol = new Map<string, {
        symbol: string;
        prices: number[];
        highs: number[];
        lows: number[];
        volByVenue: Map<string, number>;
        changes: number[];
      }>();
      for (const d of filtered) {
        const sym = (d.symbol || '').toUpperCase();
        if (!sym) continue;
        if (!bySymbol.has(sym)) {
          bySymbol.set(sym, { symbol: sym, prices: [], highs: [], lows: [], volByVenue: new Map(), changes: [] });
        }
        const row = bySymbol.get(sym)!;
        const price = Number(d.lastPrice ?? d.price);
        const high = Number(d.high24h);
        const low = Number(d.low24h);
        const vol = Number(d.quoteVolume24h ?? d.volume24h ?? 0);
        const ch = Number(d.priceChangePercent24h ?? d.changePercent24h);
        if (price > 0) row.prices.push(price);
        if (high > 0) row.highs.push(high);
        if (low > 0)  row.lows.push(low);
        if (Number.isFinite(ch) && ch !== 0) row.changes.push(ch);
        if (vol > 0 && vol <= MAX_SANE_VOL && d.exchange) {
          const prev = row.volByVenue.get(d.exchange) ?? 0;
          if (vol > prev) row.volByVenue.set(d.exchange, vol);
        }
      }
      const aggArr: AggTicker[] = Array.from(bySymbol.values()).map(r => ({
        symbol: r.symbol,
        // Median price across venues for stability (resists one-exchange outliers)
        lastPrice: r.prices.length > 0
          ? r.prices.sort((a, b) => a - b)[Math.floor(r.prices.length / 2)]
          : null,
        high24h: r.highs.length > 0 ? Math.max(...r.highs) : null,
        low24h: r.lows.length > 0 ? Math.min(...r.lows) : null,
        volume24h: Array.from(r.volByVenue.values()).reduce((a, b) => a + b, 0),
        priceChange24hPct: r.changes.length > 0
          ? r.changes.reduce((a, b) => a + b, 0) / r.changes.length
          : null,
        venueCount: r.volByVenue.size,
      }))
      .sort((a, b) => b.volume24h - a.volume24h);

      return NextResponse.json({
        success: true,
        data: aggArr,
        meta: { timestamp: Date.now(), entries: aggArr.length, mode: 'aggregate' },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          ...auth.headers,
        },
      });
    }

    const cleaned = filtered.map((d: any) => ({
      symbol: d.symbol,
      exchange: d.exchange,
      lastPrice: d.lastPrice ?? d.price ?? null,
      high24h: d.high24h ?? null,
      low24h: d.low24h ?? null,
      volume24h: d.quoteVolume24h ?? d.volume24h ?? null,
      priceChange24hPct: d.priceChangePercent24h ?? d.changePercent24h ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: cleaned,
      meta: { timestamp: Date.now(), entries: cleaned.length, mode: 'per-venue' },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/tickers error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
