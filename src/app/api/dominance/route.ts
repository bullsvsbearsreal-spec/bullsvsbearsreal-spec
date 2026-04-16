/**
 * GET /api/dominance
 *
 * Returns BTC/ETH dominance, total market cap, volume, active cryptos.
 * Uses CoinMarketCap as primary source (same as /api/global-stats, which feeds the
 * header TopStatsBar) so the BTC.D values are consistent site-wide.
 * Falls back to CoinGecko if CMC is unavailable or CMC_API_KEY is not set.
 * Cached for 5 minutes via edge cache + DB cache fallback.
 */

import { NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const CACHE_KEY = 'dominance_global';
const CACHE_TTL = 600; // 10 min DB cache (longer than the 5 min edge cache)
const CMC_API_KEY = process.env.CMC_API_KEY || '';
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' };

interface DominanceResult {
  btcDominance: number | null;
  ethDominance: number | null;
  totalMarketCap: number | null;
  totalVolume24h: number | null;
  activeCryptos: number | null;
  markets: number | null;
  marketCapChange24h: number | null;
  updatedAt: number;
  dominanceBreakdown: Record<string, number>;
  source?: string;
}

/** Try CoinMarketCap first — matches the header's /api/global-stats source */
async function fetchFromCMC(): Promise<DominanceResult | null> {
  if (!CMC_API_KEY) return null;
  try {
    const res = await fetchWithTimeout(
      'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD',
      {
        headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, Accept: 'application/json' },
      },
      10000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.data || {};
    const q = d.quote?.USD || {};

    return {
      btcDominance: d.btc_dominance ?? null,
      ethDominance: d.eth_dominance ?? null,
      totalMarketCap: q.total_market_cap ?? null,
      totalVolume24h: q.total_volume_24h ?? null,
      activeCryptos: d.active_cryptocurrencies ?? null,
      markets: d.active_market_pairs ?? null,
      marketCapChange24h: q.total_market_cap_yesterday_percentage_change ?? null,
      updatedAt: Date.now(),
      dominanceBreakdown: {
        btc: d.btc_dominance ?? 0,
        eth: d.eth_dominance ?? 0,
      },
      source: 'cmc',
    };
  } catch {
    return null;
  }
}

/** Fallback: CoinGecko free API (provides richer breakdown) */
async function fetchFromCoinGecko(): Promise<DominanceResult | null> {
  try {
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/global',
      { headers: { Accept: 'application/json' } },
      10000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.data;
    if (!d) return null;

    return {
      btcDominance: d.market_cap_percentage?.btc ?? null,
      ethDominance: d.market_cap_percentage?.eth ?? null,
      totalMarketCap: d.total_market_cap?.usd ?? null,
      totalVolume24h: d.total_volume?.usd ?? null,
      activeCryptos: d.active_cryptocurrencies ?? null,
      markets: d.markets ?? null,
      marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? null,
      updatedAt: d.updated_at ? d.updated_at * 1000 : Date.now(),
      dominanceBreakdown: d.market_cap_percentage ?? {},
      source: 'coingecko',
    };
  } catch {
    return null;
  }
}

export async function GET() {
  // Try CMC first (matches the header TopStatsBar), then CoinGecko fallback
  let result = await fetchFromCMC();

  // If CMC gave us data but only btc/eth in breakdown, enrich with CoinGecko breakdown
  if (result && Object.keys(result.dominanceBreakdown).length <= 2) {
    const cgData = await fetchFromCoinGecko();
    if (cgData?.dominanceBreakdown && Object.keys(cgData.dominanceBreakdown).length > 2) {
      // Use CMC's btc/eth dominance values (consistent with header) but CoinGecko's full breakdown
      result.dominanceBreakdown = {
        ...cgData.dominanceBreakdown,
        btc: result.btcDominance ?? cgData.dominanceBreakdown.btc ?? 0,
        eth: result.ethDominance ?? cgData.dominanceBreakdown.eth ?? 0,
      };
      if (!result.markets && cgData.markets) result.markets = cgData.markets;
    }
  }

  // Fallback to CoinGecko if CMC returned nothing
  if (!result) {
    result = await fetchFromCoinGecko();
  }

  if (result) {
    // Store in DB cache for fallback
    if (isDBConfigured()) {
      setCache(CACHE_KEY, result, CACHE_TTL).catch(e => console.warn('[dominance] cache write failed:', e));
    }
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  }

  // All live sources failed — try DB cache
  if (isDBConfigured()) {
    const cached = await getCache(CACHE_KEY);
    if (cached) return NextResponse.json({ ...cached, cached: true }, { headers: CACHE_HEADERS });
  }

  return NextResponse.json(
    { error: 'Failed to fetch dominance data from all sources' },
    { status: 502 },
  );
}
