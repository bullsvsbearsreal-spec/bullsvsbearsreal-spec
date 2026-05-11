import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { fetchWithTimeout, normalizeSymbol } from '../../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../../_shared/exchange-fetchers';
import { dedupedFetch } from '../../_shared/inflight';
import { tickerFetchers } from '../../tickers/exchanges';
import {
  EXCHANGE_FEES, FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT, getFeeScheduleSnapshot,
} from '@/lib/constants/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1 cache for ticker data (5s TTL)
let l1Cache: { data: any[]; ts: number } | null = null;
const L1_TTL = 5_000;

/**
 * GET /api/v1/spreads
 *
 * Returns cross-exchange price spreads for each symbol with gross +
 * net spread (after round-trip taker fees on both legs), per-side
 * maker + taker fees, and a `meta.feeModel` block (version + updatedAt
 * + full fee schedule) so callers can verify or recompute under their
 * own fill model. Response headers `X-Fee-Model-Version` and
 * `X-Fee-Model-Updated-At` mirror the model identifiers for cheap
 * HEAD-request bump detection.
 *
 * Query params:
 *   ?symbols=BTC,ETH   — filter by symbols (comma-separated)
 *   ?minSpread=0.01    — minimum GROSS spread % to include (default 0)
 *   ?limit=50          — max results (1–200, default 50)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const minSpread = parseFloat(searchParams.get('minSpread') || '0') || 0;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

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

    // Group by symbol
    const bySymbol = new Map<string, Array<{ exchange: string; price: number }>>();
    for (const t of rawData) {
      const price = t.lastPrice ?? t.price ?? 0;
      if (!t.symbol || price <= 0) continue;
      const sym = t.symbol.toUpperCase();
      if (symbolFilter?.length && !symbolFilter.includes(sym)) continue;
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      bySymbol.get(sym)!.push({ exchange: t.exchange, price });
    }

    // Compute spreads
    const spreads: any[] = [];
    for (const [symbol, entries] of Array.from(bySymbol.entries())) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => b.price - a.price);
      const high = entries[0];
      const low = entries[entries.length - 1];
      const spreadUsd = high.price - low.price;
      const spreadPct = low.price > 0 ? (spreadUsd / low.price) * 100 : 0;
      if (spreadPct < minSpread) continue;

      // Fee accounting: round trip = taker on the low venue (buy) +
      // taker on the high venue (sell). Spot arb doesn't need a close
      // leg unless the trader is hedging, so this is conservative.
      const highFees = EXCHANGE_FEES[high.exchange];
      const lowFees  = EXCHANGE_FEES[low.exchange];
      const roundTripFeePct = (highFees?.taker ?? 0.05) + (lowFees?.taker ?? 0.05);
      const netSpreadPct = spreadPct - roundTripFeePct;

      spreads.push({
        symbol,
        spreadPct: Math.round(spreadPct * 10000) / 10000,
        spreadUsd: Math.round(spreadUsd * 100) / 100,
        netSpreadPct: Math.round(netSpreadPct * 10000) / 10000,
        highExchange: high.exchange,
        highPrice: high.price,
        lowExchange: low.exchange,
        lowPrice: low.price,
        exchangeCount: entries.length,
        // Per-side fees so callers can recompute net under different fill
        // assumptions (maker-only routing, post-only orders, etc).
        // All values are percent-per-trade.
        fees: {
          roundTrip: Math.round(roundTripFeePct * 10000) / 10000,
          highExchangeTaker: highFees?.taker ?? null,
          highExchangeMaker: highFees?.maker ?? null,
          lowExchangeTaker:  lowFees?.taker  ?? null,
          lowExchangeMaker:  lowFees?.maker  ?? null,
        },
      });
    }

    // Sort by spread % descending
    spreads.sort((a, b) => b.spreadPct - a.spreadPct);
    const result = spreads.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        timestamp: Date.now(),
        entries: result.length,
        totalSymbols: bySymbol.size,
        // Same fee-model surface as /api/v1/arbitrage so callers using
        // both endpoints have one cache key + bump signal to track.
        feeModel: getFeeScheduleSnapshot(),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'X-Fee-Model-Version': FEE_MODEL_VERSION,
        'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/spreads error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
