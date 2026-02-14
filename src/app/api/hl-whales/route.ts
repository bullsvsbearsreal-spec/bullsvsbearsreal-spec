import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HLPosition {
  coin: string;
  szi: string;          // size (negative = short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  leverage: { type: string; value: number };
  marginUsed: string;
  maxLeverage: number;
  cumFunding: {
    allTime: string;
    sinceOpen: string;
    sinceChange: string;
  };
}

interface HLClearingHouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: Array<{
    type: string;
    position: HLPosition;
  }>;
  time: number;
}

export interface WhaleData {
  address: string;
  label: string;
  accountValue: number;
  totalNotional: number;
  marginUsed: number;
  withdrawable: number;
  positionCount: number;
  positions: Array<{
    coin: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    positionValue: number;
    unrealizedPnl: number;
    roe: number;
    leverage: number;
    liquidationPrice: number | null;
    marginUsed: number;
    cumulativeFunding: number;
  }>;
  lastUpdated: number;
}

/* ------------------------------------------------------------------ */
/*  Known whale addresses (curated, public)                            */
/* ------------------------------------------------------------------ */

const WHALE_WALLETS: Array<{ address: string; label: string }> = [
  // Major known Hyperliquid whales — public on-chain addresses
  { address: '0x31ca8395cf837de08b24da3f660e77761dfb974b', label: 'HyperWhale' },
  { address: '0xe5e4e69e2b48e83c41d1a97c1714274c08cb6443', label: 'Whale Alpha' },
  { address: '0x4a79ba1078e4c7697c386e4cedf82e6f7027d781', label: 'Degen Giant' },
  { address: '0xb6bfceb19f462dfc3ef7539b18bbdcb65d3a006f', label: 'OI King' },
  { address: '0x32e5de888caba8b0e40c2fc07c96c4c7a5c7f5a6', label: 'Perp Lord' },
  { address: '0xd11f24de21e16a16e5abb05fb8b0f0c40c993550', label: 'HL Trader 1' },
  { address: '0xf35fe4518590d08f2ed2b56a6f0131ab01f5e5c8', label: 'HL Trader 2' },
  { address: '0x0e82295049054f0fcc6dd22f89a2ddbb81e09650', label: 'Vault Whale' },
  { address: '0xc64cc00b46150e1c8fa2e4b1027e42da5f3e2472', label: 'Size Master' },
  { address: '0x6211fd05e4f7af2d83d787d1237a46ae1b21d504', label: 'HL Trader 3' },
  { address: '0xa079f9c72e47e4c3a73e3a2ec88be2ac6a1d855a', label: 'Leverage Ape' },
  { address: '0x8588f45d3e80901ae27baa12e13d5fad0f627a91', label: 'Smart Whale' },
];

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

const MEM_CACHE_TTL = 60_000; // 1 minute
const DB_CACHE_TTL = 120;     // 2 minutes
const CACHE_KEY = 'hl-whales:all';
let memCache: { data: WhaleData[]; time: number } | null = null;

/* ------------------------------------------------------------------ */
/*  Fetch single whale                                                 */
/* ------------------------------------------------------------------ */

async function fetchWhaleState(
  address: string,
  label: string,
): Promise<WhaleData | null> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as HLClearingHouseState;

    const accountValue = parseFloat(data.marginSummary.accountValue) || 0;
    const totalNotional = parseFloat(data.marginSummary.totalNtlPos) || 0;
    const marginUsed = parseFloat(data.marginSummary.totalMarginUsed) || 0;
    const withdrawable = parseFloat(data.withdrawable) || 0;

    // Skip wallets with zero or near-zero value
    if (accountValue < 1000) return null;

    const positions = (data.assetPositions || [])
      .map((ap) => {
        const p = ap.position;
        const size = parseFloat(p.szi) || 0;
        return {
          coin: p.coin,
          side: (size >= 0 ? 'long' : 'short') as 'long' | 'short',
          size: Math.abs(size),
          entryPrice: parseFloat(p.entryPx) || 0,
          positionValue: Math.abs(parseFloat(p.positionValue) || 0),
          unrealizedPnl: parseFloat(p.unrealizedPnl) || 0,
          roe: parseFloat(p.returnOnEquity) || 0,
          leverage: p.leverage?.value || 1,
          liquidationPrice: p.liquidationPx ? parseFloat(p.liquidationPx) : null,
          marginUsed: parseFloat(p.marginUsed) || 0,
          cumulativeFunding: parseFloat(p.cumFunding?.allTime) || 0,
        };
      })
      .filter((p) => p.positionValue > 100)   // Filter dust
      .sort((a, b) => b.positionValue - a.positionValue);

    return {
      address,
      label,
      accountValue,
      totalNotional,
      marginUsed,
      withdrawable,
      positionCount: positions.length,
      positions,
      lastUpdated: data.time || Date.now(),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch all whales (with concurrency control)                        */
/* ------------------------------------------------------------------ */

async function fetchAllWhales(): Promise<WhaleData[]> {
  // Fetch in batches of 4 to respect rate limits (weight 2 each, 1200 req/min)
  const batchSize = 4;
  const results: WhaleData[] = [];

  for (let i = 0; i < WHALE_WALLETS.length; i += batchSize) {
    const batch = WHALE_WALLETS.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((w) => fetchWhaleState(w.address, w.label)),
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    // Small delay between batches
    if (i + batchSize < WHALE_WALLETS.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Sort by account value descending
  return results.sort((a, b) => b.accountValue - a.accountValue);
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const singleAddress = searchParams.get('address');

  // Single wallet lookup (for custom whale tracking)
  if (singleAddress) {
    const label = searchParams.get('label') || 'Custom';
    const whale = await fetchWhaleState(singleAddress, label);
    if (!whale) {
      return NextResponse.json(
        { error: 'Could not fetch wallet data or wallet has no positions' },
        { status: 404 },
      );
    }
    return NextResponse.json(whale, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  // All whales — check caches
  if (memCache && Date.now() - memCache.time < MEM_CACHE_TTL) {
    return NextResponse.json(memCache.data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  if (isDBConfigured()) {
    try {
      const dbData = await getCache<WhaleData[]>(CACHE_KEY);
      if (dbData) {
        memCache = { data: dbData, time: Date.now() };
        return NextResponse.json(dbData, {
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
      }
    } catch { /* miss */ }
  }

  try {
    const whales = await fetchAllWhales();

    // Cache results
    memCache = { data: whales, time: Date.now() };
    if (isDBConfigured()) {
      setCache(CACHE_KEY, whales, DB_CACHE_TTL).catch(() => {});
    }

    return NextResponse.json(whales, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    // Return stale cache on error
    if (memCache) {
      return NextResponse.json(memCache.data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch whale data';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
