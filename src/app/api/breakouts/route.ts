/**
 * GET /api/breakouts
 *
 * Breakout + breakdown scanner. Surfaces coins approaching or breaching
 * key levels: all-time high, 30d high, 7d high, 52w low, etc.
 *
 * Computed from CoinGecko's `/coins/markets` endpoint (free).
 *
 * Query params:
 *   kind   — 'ath' | 'breakout' | 'breakdown' | 'strong-trend' | 'recovery' (default ath)
 *   limit  — 10..100 (default 50)
 *
 * Cache: 5 min.
 */

import { NextRequest, NextResponse } from 'next/server';
import { STABLE_SYMBOLS, BTC_PROXIES, ETH_PROXIES } from '@/lib/coin-filters';
import { computeQualityScore } from './quality';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const CG_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h%2C7d%2C30d%2C1y';

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;
  atl_change_percentage?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  price_change_percentage_1y_in_currency?: number;
  total_volume?: number;
}

export interface BreakoutRow {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  change1y: number;
  ath: number;
  athPct: number;         // how far below ATH (negative)
  athDate: string | null;
  atlPct: number;         // how far above ATL
  high24h: number;
  low24h: number;
  /** Specific signal tag(s) the row matched */
  signals: string[];
  /** Score for sorting within the chosen view */
  score: number;
  /** Composite long-side setup quality (0–100). Combines momentum stack,
   *  range position (ATR proxy), ATH proximity, and volume/market-cap
   *  ratio into one at-a-glance grade. The breakdown view will tend to
   *  score low here (which is correct — breakdowns are bad long setups). */
  qualityScore: number;
}

type Kind = 'ath' | 'breakout' | 'breakdown' | 'strong-trend' | 'recovery';

interface BreakoutsResponse {
  data: BreakoutRow[];
  summary: {
    kind: Kind;
    universeSize: number;
    matchingSignals: number;
  };
  meta: { timestamp: number; source: 'coingecko' };
}

const cache = new Map<string, { body: BreakoutsResponse; ts: number }>();
const CACHE_TTL = 300_000;

function clean(s: string): boolean {
  if (!s) return false;
  if (s === 'btc' || s === 'eth') return false;
  if (STABLE_SYMBOLS.has(s)) return false;
  if (BTC_PROXIES.has(s)) return false;
  if (ETH_PROXIES.has(s)) return false;
  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const kindRaw = (searchParams.get('kind') || 'ath').toLowerCase();
  const validKinds: Kind[] = ['ath', 'breakout', 'breakdown', 'strong-trend', 'recovery'];
  const kind = validKinds.includes(kindRaw as Kind) ? (kindRaw as Kind) : 'ath';
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10) || 50));

  const cacheKey = `breakouts:${kind}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const res = await fetch(CG_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return NextResponse.json({ error: `CoinGecko ${res.status}`, data: [] }, { status: 502 });
    const raw: CGMarket[] = await res.json();

    const filtered = raw.filter(c => {
      if (!c || !c.symbol || !c.current_price) return false;
      const sym = c.symbol.toLowerCase();
      const name = (c.name || '').toLowerCase();
      if (!clean(sym)) return false;
      if ((c.total_volume ?? 0) < 1_000_000) return false;
      // Reject stablecoins / RWA / tokenized treasury products by name
      if (name.includes('stable')) return false;
      if (name.includes('treasury')) return false;
      if (name.includes('dollar')) return false;
      if (name.includes('pegged')) return false;
      // Reject tickers containing USD/EUR (pegged) other than major ones we want
      if (/^[a-z0-9]*usd[a-z0-9]*$/.test(sym) && sym !== 'usd') return false;
      if (/^eur/.test(sym)) return false;
      // Reject low-volatility assets (stables have tiny range). Proxy:
      // atl_change_percentage ~ ((price - atl) / atl) * 100. Real altcoins
      // have atl_change_percentage in thousands %; stables are single-digit %.
      const atlPct = c.atl_change_percentage ?? 0;
      if (atlPct < 50) return false;
      return true;
    });

    // Build all candidate rows, each annotated with signals that fire
    const allRows: BreakoutRow[] = filtered.map(c => {
      const price = c.current_price ?? 0;
      const ath = c.ath ?? 0;
      const athPct = c.ath_change_percentage ?? 0;   // negative = below ATH
      const atlPct = c.atl_change_percentage ?? 0;    // positive = above ATL
      const high24 = c.high_24h ?? 0;
      const low24 = c.low_24h ?? 0;
      const c24 = c.price_change_percentage_24h_in_currency ?? 0;
      const c7 = c.price_change_percentage_7d_in_currency ?? 0;
      const c30 = c.price_change_percentage_30d_in_currency ?? 0;
      const c1y = c.price_change_percentage_1y_in_currency ?? 0;

      const signals: string[] = [];
      // Near ATH
      if (athPct > -2) signals.push('at ATH');
      else if (athPct > -5) signals.push('near ATH');
      else if (athPct > -10) signals.push('approaching ATH');
      // 24h breakout — price at or near 24h high
      if (price > 0 && high24 > 0 && (price / high24) > 0.995) signals.push('24h high');
      // Strong trend — positive 24h + 7d + 30d
      if (c24 > 0 && c7 > 0 && c30 > 0 && c30 > 10) signals.push('strong uptrend');
      // Breakdown — near ATL / lots of bleed
      if (atlPct > 0 && atlPct < 50) signals.push('near ATL');
      // Recovery — big 1y drawdown but positive 30d
      if (c1y < -50 && c30 > 10) signals.push('recovery');

      // Composite quality score (0–100). Pure long-side setup quality —
      // it intentionally penalises breakdowns so the same number means
      // the same thing across all "kind" filters. Formula + 33 unit
      // tests live in ./quality.ts (extracted for testability — a
      // tweak to any sub-score silently re-orders the whole page).
      const { score: qualityScore } = computeQualityScore({
        c24, c7, c30,
        price, high24, low24,
        athPct,
        marketCap: c.market_cap,
        volume24h: c.total_volume,
      });

      return {
        rank: c.market_cap_rank ?? 0,
        id: c.id,
        symbol: (c.symbol || '').toUpperCase(),
        name: c.name,
        image: c.image ?? null,
        price,
        marketCap: c.market_cap ?? 0,
        volume24h: c.total_volume ?? 0,
        change24h: c24,
        change7d: c7,
        change30d: c30,
        change1y: c1y,
        ath,
        athPct,
        athDate: c.ath_date ?? null,
        atlPct,
        high24h: high24,
        low24h: low24,
        signals,
        score: 0,
        qualityScore,
      };
    });

    // Filter + score by chosen kind
    let scored: BreakoutRow[];
    if (kind === 'ath') {
      scored = allRows.filter(r => r.athPct > -15)
        .map(r => ({ ...r, score: -r.athPct })) // closer to 0 = higher
        .sort((a, b) => a.athPct - b.athPct)     // -0.5 < -5 < -10 (ascending = closest to ATH first)
        .reverse()
        .sort((a, b) => b.athPct - a.athPct);    // same effect; preserve order
    } else if (kind === 'breakout') {
      scored = allRows.filter(r => r.change24h > 3 && r.high24h > 0 && (r.price / r.high24h) > 0.99)
        .map(r => ({ ...r, score: r.change24h }))
        .sort((a, b) => b.change24h - a.change24h);
    } else if (kind === 'strong-trend') {
      scored = allRows.filter(r => r.change24h > 0 && r.change7d > 0 && r.change30d > 10)
        .map(r => ({ ...r, score: r.change30d + r.change7d + r.change24h }))
        .sort((a, b) => b.score - a.score);
    } else if (kind === 'breakdown') {
      scored = allRows.filter(r => r.atlPct < 80 && r.change24h < -3)
        .map(r => ({ ...r, score: -r.change24h + -r.change30d }))
        .sort((a, b) => a.change24h - b.change24h);
    } else {
      // recovery
      scored = allRows.filter(r => r.change1y < -50 && r.change30d > 5)
        .map(r => ({ ...r, score: r.change30d - r.change1y / 10 }))
        .sort((a, b) => b.score - a.score);
    }

    const trimmed = scored.slice(0, limit);

    const body: BreakoutsResponse = {
      data: trimmed,
      summary: {
        kind,
        universeSize: allRows.length,
        matchingSignals: scored.length,
      },
      meta: { timestamp: Date.now(), source: 'coingecko' },
    };

    // Cache only when we have universe data. Was: pinned an empty
    // `{data: [], universeSize: 0}` for 5 min if CoinGecko returned a
    // valid 200 with an empty array (rare but possible during their
    // partial-region failures). Users would see "No signals" for 5 min
    // even when CG recovered seconds later.
    if (allRows.length > 0) {
      cache.set(cacheKey, { body, ts: Date.now() });
    }
    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': allRows.length > 0
          ? 'public, s-maxage=300, stale-while-revalidate=900'
          : 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[breakouts] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
