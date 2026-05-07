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
 * Returns real-time price & volume data across exchanges.
 * Query params:
 *   ?symbols=BTC,ETH        — filter by symbols (comma-separated)
 *   ?exchanges=binance,bybit — filter by exchange (comma-separated, case-insensitive)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

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
      meta: { timestamp: Date.now(), entries: cleaned.length },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (e) {
    console.error('v1/tickers error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
