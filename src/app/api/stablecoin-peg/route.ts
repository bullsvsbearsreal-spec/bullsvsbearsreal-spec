/**
 * GET /api/stablecoin-peg
 *
 * Live peg deviation tracker for major USD-denominated stablecoins.
 * Pulls current spot prices + 24h change + market caps from CoinGecko's
 * free public endpoint. Computes deviation as abs(price - 1.0) and flags
 * anything >25bps as "watch" and >100bps as "depeg risk".
 *
 * Cache: 30s.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface Stablecoin {
  id: string;              // CoinGecko id
  symbol: string;
  name: string;
  issuer: string;
  backing: 'fiat' | 'crypto' | 'algo' | 'hybrid';
}

// Stablecoins tracked — biggest + most market-structure relevant.
// Add/remove here to change the page without code changes elsewhere.
const STABLECOINS: Stablecoin[] = [
  { id: 'tether',             symbol: 'USDT',  name: 'Tether',             issuer: 'Tether Ltd',      backing: 'fiat' },
  { id: 'usd-coin',           symbol: 'USDC',  name: 'USD Coin',           issuer: 'Circle',          backing: 'fiat' },
  { id: 'dai',                symbol: 'DAI',   name: 'Dai',                issuer: 'MakerDAO',        backing: 'crypto' },
  { id: 'first-digital-usd',  symbol: 'FDUSD', name: 'First Digital USD',  issuer: 'First Digital',   backing: 'fiat' },
  { id: 'paypal-usd',         symbol: 'PYUSD', name: 'PayPal USD',         issuer: 'PayPal / Paxos',  backing: 'fiat' },
  { id: 'true-usd',           symbol: 'TUSD',  name: 'TrueUSD',            issuer: 'Archblock',       backing: 'fiat' },
  { id: 'frax',               symbol: 'FRAX',  name: 'Frax',               issuer: 'Frax Finance',    backing: 'hybrid' },
  { id: 'usdd',               symbol: 'USDD',  name: 'USDD',               issuer: 'TRON DAO',        backing: 'crypto' },
  { id: 'paxos-standard',     symbol: 'USDP',  name: 'Pax Dollar',         issuer: 'Paxos',           backing: 'fiat' },
  { id: 'gemini-dollar',      symbol: 'GUSD',  name: 'Gemini Dollar',      issuer: 'Gemini',          backing: 'fiat' },
  { id: 'ethena-usde',        symbol: 'USDe',  name: 'Ethena USDe',        issuer: 'Ethena',          backing: 'crypto' },
  { id: 'usual-usd',          symbol: 'USD0',  name: 'Usual USD',          issuer: 'Usual Protocol',  backing: 'fiat' },
];

export interface StablecoinPegRow {
  id: string;
  symbol: string;
  name: string;
  issuer: string;
  backing: string;
  price: number;
  deviationBps: number;       // (price - 1) * 10000, signed
  absDeviationBps: number;
  change24hPct: number;
  marketCap: number;
  severity: 'normal' | 'watch' | 'depeg';
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 30_000;

function severity(absBps: number): StablecoinPegRow['severity'] {
  if (absBps >= 100) return 'depeg';
  if (absBps >= 25) return 'watch';
  return 'normal';
}

export async function GET(_request: NextRequest) {
  const cacheKey = 'stablecoin-peg:v1';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const ids = STABLECOINS.map(s => s.id).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'InfoHub/2.0 (info-hub.io)',
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();

    const rows: StablecoinPegRow[] = STABLECOINS.map(s => {
      const entry = json[s.id];
      const price = entry?.usd ?? 0;
      const change = entry?.usd_24h_change ?? 0;
      const mc = entry?.usd_market_cap ?? 0;
      const deviationBps = (price - 1) * 10_000;
      const absBps = Math.abs(deviationBps);
      return {
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        issuer: s.issuer,
        backing: s.backing,
        price,
        deviationBps,
        absDeviationBps: absBps,
        change24hPct: change,
        marketCap: mc,
        severity: severity(absBps),
      };
    }).filter(r => r.price > 0);

    // Sort by absolute deviation desc — most off-peg first
    rows.sort((a, b) => b.absDeviationBps - a.absDeviationBps);

    const summary = {
      totalMarketCap: rows.reduce((s, r) => s + r.marketCap, 0),
      trackedCount: rows.length,
      depegCount: rows.filter(r => r.severity === 'depeg').length,
      watchCount: rows.filter(r => r.severity === 'watch').length,
      maxDeviationBps: rows[0]?.absDeviationBps ?? 0,
      maxDeviationSymbol: rows[0]?.symbol ?? null,
    };

    const body = {
      data: rows,
      summary,
      meta: {
        source: 'coingecko',
        timestamp: Date.now(),
        description: 'Peg deviation in basis points (1bp = 0.01%). Watch threshold: 25bp. Depeg threshold: 100bp.',
      },
    };

    // Only pin cache when we have stable peg rows. Was: cached empty
    // for 30s when CoinGecko returned 200 with no stable prices.
    if (rows.length > 0) {
      cache.set(cacheKey, { body, ts: Date.now() });
    }
    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': rows.length > 0
          ? 'public, s-maxage=30, stale-while-revalidate=120'
          : 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[stablecoin-peg] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
