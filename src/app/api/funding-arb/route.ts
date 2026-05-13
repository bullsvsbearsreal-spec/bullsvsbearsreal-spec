/**
 * GET /api/funding-arb
 *
 * Cross-exchange funding-rate arbitrage scanner. Pivots the flat funding
 * feed (symbol × exchange rows) into per-symbol summaries showing the
 * min/max funding rate across venues and the spread you could farm by
 * going long the cheap side and short the expensive side.
 *
 * Annualized return estimate assumes 8h funding intervals (3x/day).
 * Intervals shorter than 8h (most DEXes are 1h) are normalized into
 * 8h-equivalents for fair cross-venue comparison.
 *
 * Query params:
 *   min_venues  — 2..40, only include symbols trading on at least N exchanges (default 3)
 *   min_spread  — minimum |max - min| percent to include (default 0.01 = 1bp per interval)
 *   sort        — spread | volume | annualized  (default: annualized)
 *   limit       — max symbols returned (default 100)
 *
 * Cache: 60s.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface RawFunding {
  symbol: string;
  exchange: string;
  fundingRate: number;         // already in percent (e.g. 0.05 = 0.05%)
  fundingInterval?: '1h' | '4h' | '8h';
  markPrice?: number;
  type?: 'cex' | 'dex';
}

interface VenueQuote {
  exchange: string;
  rate: number;                // per-interval %
  rate8h: number;              // 8h-normalized for comparison
  interval: '1h' | '4h' | '8h';
  markPrice: number | null;
  type: 'cex' | 'dex';
}

interface ArbOpportunity {
  symbol: string;
  venueCount: number;
  min: VenueQuote;             // cheapest funding (LONG this side to get paid / pay less)
  max: VenueQuote;             // most expensive funding (SHORT this side to collect)
  spread8h: number;            // in % per 8h
  annualized: number;          // spread8h × 3 × 365
  venues: VenueQuote[];        // all quotes sorted by rate ascending
  direction: 'long_min_short_max' | 'symmetric'; // which leg pays
  dexOnOneSide: boolean;       // true if a CEX on one side + DEX on other
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 60_000;

function normalizeTo8h(rate: number, interval: '1h' | '4h' | '8h' | undefined): number {
  // Treat missing interval as 8h — the majority of CEX perps settle on 8h
  if (!interval || interval === '8h') return rate;
  if (interval === '4h') return rate * 2;
  if (interval === '1h') return rate * 8;
  return rate;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const minVenues = Math.max(2, Math.min(40, parseInt(searchParams.get('min_venues') || '3', 10) || 3));
  const minSpread = Math.max(0, parseFloat(searchParams.get('min_spread') || '0.01') || 0.01);
  const sortRaw = (searchParams.get('sort') || 'annualized').toLowerCase();
  const sort = (['spread', 'annualized', 'venues'].includes(sortRaw) ? sortRaw : 'annualized') as
    'spread' | 'annualized' | 'venues';
  const limit = Math.max(1, Math.min(500, parseInt(searchParams.get('limit') || '100', 10) || 100));

  const cacheKey = `funding-arb:${minVenues}:${minSpread}:${sort}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    // Internal fetch — reuse the already-cached aggregated funding route.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
    const res = await fetch(`${baseUrl}/api/funding?assetClass=crypto`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `funding upstream ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();
    const rows: RawFunding[] = json?.data || [];

    // Group by symbol, dedupe exchange (some exchanges have USDT-M + COIN-M
    // duplicates — keep the first seen, usually the linear/USDT one).
    const bySymbol = new Map<string, Map<string, VenueQuote>>();
    for (const r of rows) {
      if (!Number.isFinite(r.fundingRate)) continue;
      // Drop pure-digit symbol artifacts from parser bugs
      if (!r.symbol || /^\d+$/.test(r.symbol)) continue;
      const interval = (r.fundingInterval as '1h' | '4h' | '8h') || '8h';
      const rate = r.fundingRate;
      const quote: VenueQuote = {
        exchange: r.exchange,
        rate,
        rate8h: normalizeTo8h(rate, interval),
        interval,
        markPrice: r.markPrice ?? null,
        type: r.type ?? 'cex',
      };
      let venues = bySymbol.get(r.symbol);
      if (!venues) { venues = new Map(); bySymbol.set(r.symbol, venues); }
      // Prefer non-zero, prefer higher magnitude if duplicate exchange
      const existing = venues.get(r.exchange);
      if (!existing || Math.abs(quote.rate8h) > Math.abs(existing.rate8h)) {
        venues.set(r.exchange, quote);
      }
    }

    // Build arb opportunities
    const opportunities: ArbOpportunity[] = [];
    bySymbol.forEach((venuesMap, symbol) => {
      if (venuesMap.size < minVenues) return;
      const venues = Array.from(venuesMap.values()).sort((a, b) => a.rate8h - b.rate8h);
      const min = venues[0];
      const max = venues[venues.length - 1];
      const spread8h = max.rate8h - min.rate8h;
      if (spread8h < minSpread) return;
      const annualized = spread8h * 3 * 365;
      const types = new Set(venues.map(v => v.type));
      opportunities.push({
        symbol,
        venueCount: venues.length,
        min,
        max,
        spread8h,
        annualized,
        venues,
        direction: 'long_min_short_max',
        dexOnOneSide: types.size > 1,
      });
    });

    // Sort
    if (sort === 'venues') opportunities.sort((a, b) => b.venueCount - a.venueCount);
    else if (sort === 'spread') opportunities.sort((a, b) => b.spread8h - a.spread8h);
    else opportunities.sort((a, b) => b.annualized - a.annualized);

    const trimmed = opportunities.slice(0, limit);

    // Count distinct exchanges that actually contributed at least one
    // quote so the UI badge can stop saying "30+ exchanges" as a literal.
    const exchangesScanned = new Set<string>();
    bySymbol.forEach(venuesMap => {
      venuesMap.forEach((_, exchange) => exchangesScanned.add(exchange));
    });

    const summary = {
      totalSymbols: opportunities.length,
      displayed: trimmed.length,
      topAnnualized: trimmed[0]?.annualized ?? 0,
      topSymbol: trimmed[0]?.symbol ?? null,
      medianSpread: opportunities.length
        ? opportunities[Math.floor(opportunities.length / 2)].spread8h
        : 0,
      dexCrossSymbols: opportunities.filter(o => o.dexOnOneSide).length,
      exchangesScanned: exchangesScanned.size,
    };

    const body = {
      data: trimmed,
      summary,
      meta: {
        minVenues,
        minSpread,
        sort,
        limit,
        timestamp: Date.now(),
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    if (cache.size > 30) {
      const now = Date.now();
      Array.from(cache.entries()).forEach(([k, v]) => {
        if (now - v.ts > CACHE_TTL * 3) cache.delete(k);
      });
    }

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[funding-arb] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
