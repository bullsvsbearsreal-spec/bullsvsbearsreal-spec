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
  predictedRate?: number;      // next-window forecast %
  // Symmetric borrowing fee (mostly DEXes — gTrade, GMX). Both sides
  // pay this regardless of direction, so it's a pure cost layered on
  // top of funding for anyone running a delta-neutral funding-farm.
  // Surfaced on FundingData by the GMX + gTrade fetchers in
  // src/app/api/funding/exchanges.ts. CEXes don't have a borrowing
  // fee per se and leave this undefined.
  borrowingRate?: number;
  fundingInterval?: '1h' | '4h' | '8h';
  markPrice?: number;
  type?: 'cex' | 'dex';
}

interface VenueQuote {
  exchange: string;
  rate: number;                // per-interval %
  rate8h: number;              // 8h-normalized for comparison
  predicted8h: number | null;  // 8h-normalized predicted next-window rate
  // 8h-normalized borrow cost for this venue. 0 for CEXes (no borrow).
  // For DEXes this is the gross-cost-of-renting-pool-liquidity that
  // a funding farmer has to subtract from the funding spread to get
  // the actual net carry. Reported as a positive number.
  borrow8h: number;
  interval: '1h' | '4h' | '8h';
  markPrice: number | null;
  type: 'cex' | 'dex';
}

interface ArbOpportunity {
  symbol: string;
  venueCount: number;
  min: VenueQuote;             // cheapest funding (LONG this side to get paid / pay less)
  max: VenueQuote;             // most expensive funding (SHORT this side to collect)
  spread8h: number;            // in % per 8h, GROSS of borrow fees
  predictedSpread8h: number | null; // 8h-normalized next-window spread, null if either side lacks predictedRate
  annualized: number;          // spread8h × 3 × 365
  predictedAnnualized: number | null; // annualized off predictedSpread8h
  // NET-of-borrow spread for the long_min_short_max trade. Equals
  // spread8h minus borrow on both legs (CEX leg contributes 0).
  // This is the number Christian + snake actually care about — the
  // gross spread overstates carry on DEX legs by 30-60% APR for many
  // alts where pool utilization is high. May be negative when borrow
  // exceeds the funding gap.
  netSpread8h: number;
  netAnnualized: number;
  // Total borrow cost on both legs (8h-normalized %). Lets the UI
  // show "spread 0.18% / borrow 0.05% / net 0.13%" breakdowns.
  totalBorrow8h: number;
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
  // 'net' sorts by netAnnualized (spread minus borrow). For funding-farm
  // operators this is the one that matters — many alt pairs on gTrade /
  // GMX show 100%+ gross annualized that's actually negative after
  // borrow drag. The 'annualized' default stays the same so existing
  // callers and the API contract don't break.
  const sort = (['spread', 'annualized', 'net', 'venues'].includes(sortRaw) ? sortRaw : 'annualized') as
    'spread' | 'annualized' | 'net' | 'venues';
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
      // Borrow rate 8h-normalization: GMX reports a 1h rate (its continuous
      // model), gTrade reports an 8h rate. Use the venue's own funding
      // interval as the normalization basis — borrow accrues over the
      // same window that funding does. CEXes leave borrowingRate
      // undefined → 0 contribution to the net.
      const borrow8h = r.borrowingRate != null && Number.isFinite(r.borrowingRate)
        ? normalizeTo8h(Math.abs(r.borrowingRate), interval)
        : 0;
      const quote: VenueQuote = {
        exchange: r.exchange,
        rate,
        rate8h: normalizeTo8h(rate, interval),
        // Surface the predicted next-window rate too, 8h-normalized for
        // cross-venue comparison. Partners can compare current spread vs
        // predicted spread to decide whether to enter NOW or wait for
        // the next settlement to lock in a wider gap.
        predicted8h: r.predictedRate != null && Number.isFinite(r.predictedRate)
          ? normalizeTo8h(r.predictedRate, interval)
          : null,
        borrow8h,
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
      // Predicted next-window spread — null when either leg lacks
      // predictedRate (HTX, Lighter, etc.). Partners doing 'enter now
      // vs wait for next settlement' decisions need this signal.
      const predictedSpread8h =
        min.predicted8h != null && max.predicted8h != null
          ? max.predicted8h - min.predicted8h
          : null;
      const predictedAnnualized = predictedSpread8h != null
        ? predictedSpread8h * 3 * 365
        : null;
      const types = new Set(venues.map(v => v.type));
      // Net-of-borrow: a delta-neutral funding farmer pays borrow on
      // BOTH legs (long-leg and short-leg, on the venue side that
      // has borrow). For a long-DEX / short-CEX trade only the DEX
      // leg charges borrow, so total borrow drag = min.borrow8h +
      // max.borrow8h, with CEX legs contributing 0 (already enforced
      // at venue-quote build time).
      const totalBorrow8h = min.borrow8h + max.borrow8h;
      const netSpread8h = spread8h - totalBorrow8h;
      const netAnnualized = netSpread8h * 3 * 365;
      opportunities.push({
        symbol,
        venueCount: venues.length,
        min,
        max,
        spread8h,
        predictedSpread8h,
        annualized,
        predictedAnnualized,
        netSpread8h,
        netAnnualized,
        totalBorrow8h,
        venues,
        direction: 'long_min_short_max',
        dexOnOneSide: types.size > 1,
      });
    });

    // Sort
    if (sort === 'venues') opportunities.sort((a, b) => b.venueCount - a.venueCount);
    else if (sort === 'spread') opportunities.sort((a, b) => b.spread8h - a.spread8h);
    else if (sort === 'net') opportunities.sort((a, b) => b.netAnnualized - a.netAnnualized);
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

    // Only pin the cache when we have opportunities. Was: cached
    // `{data: [], totalSymbols: 0}` for 60s when the /api/funding fan-out
    // returned empty (all-venue outage). /api/v1/funding-arb proxies this
    // route, so partner consumers would also see empty for 60s post-recovery.
    if (opportunities.length > 0) {
      cache.set(cacheKey, { body, ts: Date.now() });
      if (cache.size > 30) {
        const now = Date.now();
        Array.from(cache.entries()).forEach(([k, v]) => {
          if (now - v.ts > CACHE_TTL * 3) cache.delete(k);
        });
      }
    }

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': opportunities.length > 0
          ? 'public, s-maxage=60, stale-while-revalidate=180'
          : 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[funding-arb] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
