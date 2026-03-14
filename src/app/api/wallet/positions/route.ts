import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import type { HLClearingHouseState } from '../../_shared/hyperliquid-types';

interface DexPosition {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  roe: number;
  leverage: number;
  liquidationPrice: number | null;
  marginUsed: number;
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

const cache = new Map<string, { data: unknown; time: number }>();
const CACHE_TTL = 60_000; // 60s

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data as T;
  return null;
}

function setMem(key: string, data: unknown) {
  cache.set(key, { data, time: Date.now() });
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid helpers                                                */
/* ------------------------------------------------------------------ */

async function fetchClearinghouseState(address: string): Promise<HLClearingHouseState | null> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as HLClearingHouseState;
  } catch {
    return null;
  }
}

async function fetchMarkPrices(): Promise<Record<string, number>> {
  // Check cache first
  const cached = getCached<Record<string, number>>('hl:markPrices');
  if (cached) return cached;

  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};
    const [meta, assetCtxs] = await res.json();
    const map: Record<string, number> = {};
    const symbols: string[] = meta?.universe?.map((u: { name: string }) => u.name) ?? [];
    for (let i = 0; i < symbols.length && i < assetCtxs.length; i++) {
      const px = parseFloat(assetCtxs[i]?.markPx);
      if (!isNaN(px)) map[symbols[i]] = px;
    }
    setMem('hl:markPrices', map);
    return map;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }

  // Check cache
  const cacheKey = `positions:${address.toLowerCase()}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  // Fetch clearinghouse state + mark prices in parallel
  const [state, markPriceMap] = await Promise.all([
    fetchClearinghouseState(address),
    fetchMarkPrices(),
  ]);

  if (!state) {
    return NextResponse.json({
      exchange: 'hyperliquid',
      accountValue: 0,
      totalMarginUsed: 0,
      positions: [],
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  const accountValue = parseFloat(state.marginSummary.accountValue) || 0;
  const totalMarginUsed = parseFloat(state.marginSummary.totalMarginUsed) || 0;

  const positions: DexPosition[] = [];
  for (const ap of state.assetPositions) {
    const p = ap.position;
    const size = parseFloat(p.szi) || 0;
    if (Math.abs(parseFloat(p.positionValue) || 0) < 1) continue; // skip dust

    positions.push({
      exchange: 'hyperliquid',
      symbol: p.coin,
      side: size >= 0 ? 'long' : 'short',
      size: Math.abs(size),
      entryPrice: parseFloat(p.entryPx) || 0,
      markPrice: markPriceMap[p.coin] || parseFloat(p.entryPx) || 0,
      positionValue: Math.abs(parseFloat(p.positionValue) || 0),
      unrealizedPnl: parseFloat(p.unrealizedPnl) || 0,
      roe: (parseFloat(p.returnOnEquity) || 0) * 100,
      leverage: p.leverage?.value || 1,
      liquidationPrice: p.liquidationPx ? parseFloat(p.liquidationPx) : null,
      marginUsed: parseFloat(p.marginUsed) || 0,
    });
  }

  // Sort by position value descending
  positions.sort((a, b) => b.positionValue - a.positionValue);

  const result = { exchange: 'hyperliquid', accountValue, totalMarginUsed, positions };
  setMem(cacheKey, result);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
