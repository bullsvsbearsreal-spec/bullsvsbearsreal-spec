/**
 * GET /api/outperformers?window=7d
 *
 * Altcoin outperformance screener — which alts are beating BTC & ETH
 * across a rolling window. Uses CoinGecko's free /coins/markets endpoint.
 *
 * Returns each coin's raw change, relative-to-BTC, and relative-to-ETH
 * so the UI can render either lens.
 *
 * Query params:
 *   window — '24h' | '7d' | '30d' (default 7d)
 *   limit  — 10..200 (default 100)
 *
 * Cache: 5 min.
 */

import { NextRequest, NextResponse } from 'next/server';
import { STABLE_SYMBOLS, BTC_PROXIES, ETH_PROXIES, hasExcludedName } from '@/lib/coin-filters';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const COINGECKO_MARKETS = 'https://api.coingecko.com/api/v3/coins/markets';

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
}

export interface OutperformRow {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  marketCap: number;
  change: number;
  vsBtc: number;
  vsEth: number;
  beatsBtc: boolean;
  beatsEth: boolean;
  beatsBoth: boolean;
}

interface OutperformersResponse {
  data: OutperformRow[];
  summary: {
    windowDays: '24h' | '7d' | '30d' | '7d-fallback';
    btcChange: number;
    ethChange: number;
    beatBtcCount: number;
    beatEthCount: number;
    beatBothCount: number;
    universeSize: number;
    topPerformer: string | null;
    topPerformerRel: number;
  };
  meta: { timestamp: number; source: 'coingecko' };
}

const cache = new Map<string, { body: OutperformersResponse; ts: number }>();
const CACHE_TTL = 300_000;

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function windowField(w: string): 'price_change_percentage_24h_in_currency' | 'price_change_percentage_7d_in_currency' | 'price_change_percentage_30d_in_currency' {
  if (w === '24h') return 'price_change_percentage_24h_in_currency';
  if (w === '30d') return 'price_change_percentage_30d_in_currency';
  return 'price_change_percentage_7d_in_currency';
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const win = (searchParams.get('window') || '7d').toLowerCase();
  const window: '24h' | '7d' | '30d' = (win === '24h' || win === '30d') ? (win as '24h' | '30d') : '7d';
  const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '100', 10) || 100));

  const cacheKey = `outperformers:${window}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const url = `${COINGECKO_MARKETS}?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h%2C7d%2C30d`;
  const raw = await fetchJson<CGMarket[]>(url);
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: 'CoinGecko unavailable', data: [] }, { status: 502 });
  }

  // Detect which window CoinGecko actually populated (free tier may drop 30d)
  const fieldPreferred = windowField(window);
  const hasPreferred = raw.some(c => (c as any)[fieldPreferred] != null);
  const chosenField: keyof CGMarket = hasPreferred
    ? fieldPreferred
    : 'price_change_percentage_7d_in_currency';
  const resolvedWindow: OutperformersResponse['summary']['windowDays'] =
    !hasPreferred && window !== '7d' ? '7d-fallback' : window;

  const btc = raw.find(c => c.id === 'bitcoin' || c.symbol?.toLowerCase() === 'btc');
  const eth = raw.find(c => c.id === 'ethereum' || c.symbol?.toLowerCase() === 'eth');
  const btcChange = (btc as any)?.[chosenField] ?? 0;
  const ethChange = (eth as any)?.[chosenField] ?? 0;

  const alts = raw.filter(c => {
    const sym = (c.symbol || '').toLowerCase();
    if (!sym || sym === 'btc' || sym === 'eth') return false;
    if (STABLE_SYMBOLS.has(sym)) return false;
    if (BTC_PROXIES.has(sym)) return false;
    if (ETH_PROXIES.has(sym)) return false;
    if ((c as any)[chosenField] == null) return false;
    if (hasExcludedName(c.name)) return false;
    return true;
  });

  const rows: OutperformRow[] = alts.map(c => {
    const change = (c as any)[chosenField] ?? 0;
    const vsBtc = change - btcChange;
    const vsEth = change - ethChange;
    return {
      rank: c.market_cap_rank ?? 0,
      id: c.id,
      symbol: (c.symbol || '').toUpperCase(),
      name: c.name,
      image: c.image ?? null,
      price: c.current_price ?? 0,
      marketCap: c.market_cap ?? 0,
      change,
      vsBtc,
      vsEth,
      beatsBtc: vsBtc > 0,
      beatsEth: vsEth > 0,
      beatsBoth: vsBtc > 0 && vsEth > 0,
    };
  });

  rows.sort((a, b) => b.vsBtc - a.vsBtc);
  const trimmed = rows.slice(0, limit);

  const beatBtcCount = rows.filter(r => r.beatsBtc).length;
  const beatEthCount = rows.filter(r => r.beatsEth).length;
  const beatBothCount = rows.filter(r => r.beatsBoth).length;
  const top = trimmed[0];

  const body: OutperformersResponse = {
    data: trimmed,
    summary: {
      windowDays: resolvedWindow,
      btcChange,
      ethChange,
      beatBtcCount,
      beatEthCount,
      beatBothCount,
      universeSize: rows.length,
      topPerformer: top ? top.symbol : null,
      topPerformerRel: top ? top.vsBtc : 0,
    },
    meta: { timestamp: Date.now(), source: 'coingecko' },
  };

  cache.set(cacheKey, { body, ts: Date.now() });
  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  });
}
