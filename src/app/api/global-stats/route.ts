import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';

const CMC_API_KEY = process.env.CMC_API_KEY || '';

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' };
const DB_CACHE_KEY = 'global_stats';
const DB_CACHE_TTL = 600; // 10 min DB cache

// In-memory fallback so we never return 502 after one success
let lastGood: any = null;

// ---------------------------------------------------------------------------
// Altcoin Season Index (% of top 100 that outperformed BTC over 90d via CMC)
// ---------------------------------------------------------------------------
async function fetchAltcoinSeasonIndex(): Promise<number | null> {
  if (!CMC_API_KEY) return null;
  try {
    const res = await fetchWithTimeout(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=120&convert=USD&sort=market_cap',
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, Accept: 'application/json' } },
      12000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const coins: any[] = json?.data;
    if (!Array.isArray(coins) || coins.length === 0) return null;

    const btc = coins.find((c: any) => c.symbol === 'BTC');
    const btcChange90d = btc?.quote?.USD?.percent_change_90d ?? 0;

    const stables = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FDUSD', 'USDD', 'PYUSD', 'USDE', 'FRAX']);
    const alts = coins
      .filter((c: any) => c.symbol !== 'BTC' && !stables.has(c.symbol) && c.quote?.USD?.percent_change_90d != null)
      .slice(0, 100);
    if (alts.length === 0) return null;

    const outperformCount = alts.filter((c: any) => (c.quote.USD.percent_change_90d ?? 0) > btcChange90d).length;
    return Math.round((outperformCount / alts.length) * 100);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch total derivatives OI from CoinGecko (sum of all exchange OI in BTC → USD)
// ---------------------------------------------------------------------------
async function fetchDerivativesOI(): Promise<number | null> {
  try {
    // Fetch derivatives exchanges + BTC price in parallel
    const [exRes, priceRes] = await Promise.all([
      fetchWithTimeout(
        'https://api.coingecko.com/api/v3/derivatives/exchanges?per_page=100&order=open_interest_btc_desc',
        { headers: { Accept: 'application/json' } },
        10000,
      ),
      fetchWithTimeout(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        { headers: { Accept: 'application/json' } },
        8000,
      ),
    ]);

    if (!exRes.ok) return null;
    const exchanges: Array<{ open_interest_btc?: number }> = await exRes.json();
    if (!Array.isArray(exchanges) || exchanges.length === 0) return null;

    let totalOiBtc = 0;
    for (const ex of exchanges) {
      const oi = ex.open_interest_btc;
      if (typeof oi === 'number' && oi > 0) totalOiBtc += oi;
    }

    // Get BTC price from simple/price endpoint, fallback to reasonable estimate
    let btcPrice = 90000;
    if (priceRes.ok) {
      try {
        const priceData = await priceRes.json();
        if (priceData?.bitcoin?.usd > 0) btcPrice = priceData.bitcoin.usd;
      } catch { /* use fallback */ }
    }

    return totalOiBtc * btcPrice;
  } catch {
    return null;
  }
}

export async function GET() {
  let result: any = null;

  // Try CMC first (if key exists)
  if (CMC_API_KEY) {
    try {
      const res = await fetchWithTimeout(
        'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD',
        {
          headers: {
            'X-CMC_PRO_API_KEY': CMC_API_KEY,
            Accept: 'application/json',
          },
        },
      );

      if (res.ok) {
        const json = await res.json();
        const d = json.data || {};
        const q = d.quote?.USD || {};

        result = {
          total_market_cap: { usd: q.total_market_cap || 0 },
          total_volume: { usd: q.total_volume_24h || 0 },
          market_cap_percentage: {
            btc: d.btc_dominance || 0,
            eth: d.eth_dominance || 0,
          },
          market_cap_change_percentage_24h_usd: q.total_market_cap_yesterday_percentage_change || 0,
          active_cryptocurrencies: d.active_cryptocurrencies || 0,
        };
      }
    } catch {
      // Fall through to CoinGecko
    }
  }

  // Fallback: CoinGecko free API (no key needed)
  if (!result) {
    try {
      const res = await fetchWithTimeout(
        'https://api.coingecko.com/api/v3/global',
        { headers: { Accept: 'application/json' } },
        8000,
      );

      if (res.ok) {
        const json = await res.json();
        const d = json.data || {};

        result = {
          total_market_cap: { usd: d.total_market_cap?.usd || 0 },
          total_volume: { usd: d.total_volume?.usd || 0 },
          market_cap_percentage: {
            btc: d.market_cap_percentage?.btc || 0,
            eth: d.market_cap_percentage?.eth || 0,
          },
          market_cap_change_percentage_24h_usd: d.market_cap_change_percentage_24h_usd || 0,
          active_cryptocurrencies: d.active_cryptocurrencies || 0,
        };
      }
    } catch {
      // Fall through to cached/static fallback
    }
  }

  // Enrich with derivatives OI + altcoin season (parallel CoinGecko calls)
  if (result) {
    const [derivativesOI, altSeasonIndex] = await Promise.all([
      fetchDerivativesOI(),
      fetchAltcoinSeasonIndex(),
    ]);
    if (derivativesOI && derivativesOI > 0) {
      result.total_derivatives_oi = derivativesOI;
    }
    if (altSeasonIndex !== null) {
      result.altcoin_season_index = altSeasonIndex;
    }

    lastGood = result;
    if (isDBConfigured()) setCache(DB_CACHE_KEY, result, DB_CACHE_TTL).catch(() => {});
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  }

  // Return last known good data if we have it (L1: memory)
  if (lastGood) {
    return NextResponse.json(lastGood, { headers: CACHE_HEADERS });
  }

  // L2: DB cache fallback (survives cold starts)
  if (isDBConfigured()) {
    const cached = await getCache(DB_CACHE_KEY);
    if (cached) return NextResponse.json({ ...cached, cached: true }, { headers: CACHE_HEADERS });
  }

  // All sources exhausted — signal unavailable instead of fake zeros
  return NextResponse.json({
    total_market_cap: { usd: 0 },
    total_volume: { usd: 0 },
    market_cap_percentage: { btc: 0, eth: 0 },
    market_cap_change_percentage_24h_usd: 0,
    active_cryptocurrencies: 0,
    unavailable: true,
  }, { headers: CACHE_HEADERS });
}
