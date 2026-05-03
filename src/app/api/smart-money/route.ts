/**
 * GET /api/smart-money
 *
 * Aggregates the GMX V2 and Hyperliquid leaderboards I already ingest and
 * filters them into a "proven alpha" shortlist — wallets with real size,
 * real trade count, and real PnL. Then inspects each wallet's current
 * positions to compute live net directional bias (% long vs % short on
 * BTC, ETH, SOL, etc.).
 *
 * Query params:
 *   min_pnl     — lifetime realized PnL floor in USD (default 250_000)
 *   min_volume  — lifetime volume floor in USD (default 10_000_000)
 *   min_wr      — minimum win rate % (default 55)
 *   min_trades  — minimum closed count (default 20)
 *   include     — 'gmx' | 'hl' | 'both' (default 'both')
 *   limit       — max wallets returned (default 50)
 *
 * Cache: 2 minutes — the ingredient leaderboards cache upstream so we
 * don't double-hammer.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface SmartWallet {
  address: string;
  displayName: string | null;
  venues: Array<'gmx-arbitrum' | 'gmx-avalanche' | 'hyperliquid'>;
  // Unified metrics (best-of-breed from whichever venue supplied them)
  realizedPnl: number;
  volume: number;
  wins: number;
  losses: number;
  winRate: number;
  closedCount: number;
  maxCapital: number;
  // Current open positions on ANY tracked venue (summed)
  liveNotional: number;
  liveUnrealizedPnl: number;
  openPositionsCount: number;
  directionalBias: number;      // -1 (all short) → +1 (all long), notional-weighted
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 120_000;

interface GMXTraderLite {
  address: string;
  realizedPnl: number;
  volume: number;
  wins: number;
  losses: number;
  totalTrades: number;
  winRate: number;
  closedCount: number;
  maxCapital: number;
}

interface HLTraderLite {
  address: string;
  displayName: string | null;
  accountValue: number;
  pnl: number;           // window pnl
  volume: number;        // window volume
  roi: number;
}

async function fetchGMX(baseUrl: string, chain: 'arbitrum' | 'avalanche'): Promise<GMXTraderLite[]> {
  try {
    const res = await fetch(`${baseUrl}/api/gmx-traders?chain=${chain}&period=total&sort=volume_weighted&limit=200`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data || [];
  } catch { return []; }
}

async function fetchHL(baseUrl: string): Promise<HLTraderLite[]> {
  try {
    // "allTime" captures the full lifetime PnL we want for smart-money filtering
    const res = await fetch(`${baseUrl}/api/hl-traders?period=allTime&sort=pnl&limit=500`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data || [];
  } catch { return []; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const minPnl = Math.max(0, parseFloat(searchParams.get('min_pnl') || '250000') || 250_000);
  const minVolume = Math.max(0, parseFloat(searchParams.get('min_volume') || '10000000') || 10_000_000);
  const minWr = Math.max(0, Math.min(100, parseFloat(searchParams.get('min_wr') || '55') || 55));
  const minTrades = Math.max(0, parseInt(searchParams.get('min_trades') || '20', 10) || 20);
  const include = (searchParams.get('include') || 'both').toLowerCase() as 'gmx' | 'hl' | 'both';
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));

  const cacheKey = `smart-money:${minPnl}:${minVolume}:${minWr}:${minTrades}:${include}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';

  // Fetch source leaderboards in parallel
  const [gmxArb, gmxAvax, hl] = await Promise.all([
    include === 'hl' ? Promise.resolve([] as GMXTraderLite[]) : fetchGMX(baseUrl, 'arbitrum'),
    include === 'hl' ? Promise.resolve([] as GMXTraderLite[]) : fetchGMX(baseUrl, 'avalanche'),
    include === 'gmx' ? Promise.resolve([] as HLTraderLite[]) : fetchHL(baseUrl),
  ]);

  // Merge into one wallet map keyed by lowercase address
  const byAddr = new Map<string, SmartWallet>();

  const upsertGMX = (t: GMXTraderLite, chain: 'arbitrum' | 'avalanche') => {
    if (t.realizedPnl < minPnl) return;
    if (t.volume < minVolume) return;
    if (t.winRate < minWr) return;
    if (t.closedCount < minTrades) return;
    const key = t.address.toLowerCase();
    const venueTag = chain === 'arbitrum' ? 'gmx-arbitrum' : 'gmx-avalanche';
    const existing = byAddr.get(key);
    if (existing) {
      // Same wallet on both GMX chains — sum PnL + volume, keep best stats
      existing.venues.push(venueTag);
      existing.realizedPnl += t.realizedPnl;
      existing.volume += t.volume;
      existing.wins += t.wins;
      existing.losses += t.losses;
      existing.closedCount += t.closedCount;
      existing.maxCapital = Math.max(existing.maxCapital, t.maxCapital);
      const totalTrades = existing.wins + existing.losses;
      existing.winRate = totalTrades > 0 ? (existing.wins / totalTrades) * 100 : existing.winRate;
    } else {
      byAddr.set(key, {
        address: t.address,
        displayName: null,
        venues: [venueTag],
        realizedPnl: t.realizedPnl,
        volume: t.volume,
        wins: t.wins,
        losses: t.losses,
        winRate: t.winRate,
        closedCount: t.closedCount,
        maxCapital: t.maxCapital,
        liveNotional: 0,
        liveUnrealizedPnl: 0,
        openPositionsCount: 0,
        directionalBias: 0,
      });
    }
  };

  for (const t of gmxArb) upsertGMX(t, 'arbitrum');
  for (const t of gmxAvax) upsertGMX(t, 'avalanche');

  // HL has a very different data shape — the leaderboard gives us window-level
  // PnL, not lifetime realized. Use allTime window + accountValue as proxies.
  for (const t of hl) {
    if (t.pnl < minPnl) continue;
    if (t.volume < minVolume) continue;
    // HL doesn't expose wins/losses or winRate per-trader from the leaderboard,
    // so we can only filter on pnl + volume here. Omit WR filter for HL traders.
    const key = t.address.toLowerCase();
    const existing = byAddr.get(key);
    if (existing) {
      existing.venues.push('hyperliquid');
      if (t.displayName && !existing.displayName) existing.displayName = t.displayName;
      // Don't sum PnL cross-venue (different accounting models, would mislead);
      // keep the larger value as the "headline" and track venues separately.
      existing.realizedPnl = Math.max(existing.realizedPnl, t.pnl);
      existing.volume = Math.max(existing.volume, t.volume);
    } else {
      byAddr.set(key, {
        address: t.address,
        displayName: t.displayName,
        venues: ['hyperliquid'],
        realizedPnl: t.pnl,
        volume: t.volume,
        wins: 0,
        losses: 0,
        winRate: 0,
        closedCount: 0,
        maxCapital: 0,
        liveNotional: 0,
        liveUnrealizedPnl: 0,
        openPositionsCount: 0,
        directionalBias: 0,
      });
    }
  }

  // For top N wallets, enrich with live positions from a side fetch.
  // We limit the live-position enrichment to top 30 to keep total response
  // time reasonable (each dossier is ~500ms).
  const sorted = Array.from(byAddr.values()).sort((a, b) => b.realizedPnl - a.realizedPnl);
  const toEnrich = sorted.slice(0, Math.min(30, limit));

  async function enrich(w: SmartWallet): Promise<void> {
    // Try HL first since it's the single canonical source across all coins.
    // Fall back to GMX on whichever chain the wallet actually trades.
    const targetChain = w.venues.includes('gmx-avalanche') && !w.venues.includes('gmx-arbitrum')
      ? 'avalanche'
      : 'arbitrum';
    const targetUrl = w.venues.includes('hyperliquid')
      ? `${baseUrl}/api/hl-traders/${w.address}`
      : `${baseUrl}/api/gmx-traders/${w.address}?chain=${targetChain}`;
    try {
      const res = await fetch(targetUrl, { signal: AbortSignal.timeout(6_000) });
      if (!res.ok) return;
      const json = await res.json();
      const positions: any[] = json?.openPositions || [];
      let longNotional = 0;
      let shortNotional = 0;
      let unrealized = 0;
      for (const p of positions) {
        const size = Number(p.sizeUsd) || 0;
        if (p.isLong) longNotional += size; else shortNotional += size;
        unrealized += Number(p.unrealizedPnl) || 0;
      }
      const total = longNotional + shortNotional;
      w.liveNotional = total;
      w.liveUnrealizedPnl = unrealized;
      w.openPositionsCount = positions.length;
      w.directionalBias = total > 0 ? (longNotional - shortNotional) / total : 0;
    } catch { /* swallow — enrichment is best-effort */ }
  }

  // Parallel enrichment with a concurrency cap of 6 to be polite to upstream APIs
  const queue = [...toEnrich];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < 6; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await enrich(next);
      }
    })());
  }
  await Promise.all(workers);

  const final = sorted.slice(0, limit);

  // Aggregate market sentiment — across the enriched wallets, are the pros net long or net short?
  const enriched = final.filter(w => w.liveNotional > 0);
  const enrichedTotalNotional = enriched.reduce((s, w) => s + w.liveNotional, 0);
  const weightedBias = enrichedTotalNotional > 0
    ? enriched.reduce((s, w) => s + w.directionalBias * w.liveNotional, 0) / enrichedTotalNotional
    : 0;
  const longPct = (1 + weightedBias) * 50;

  const summary = {
    walletCount: final.length,
    enrichedCount: enriched.length,
    totalLifetimePnl: final.reduce((s, w) => s + w.realizedPnl, 0),
    totalVolume: final.reduce((s, w) => s + w.volume, 0),
    totalLiveNotional: enrichedTotalNotional,
    totalLiveUnrealized: enriched.reduce((s, w) => s + w.liveUnrealizedPnl, 0),
    smartMoneyLongPct: longPct,
    crossVenueCount: final.filter(w => w.venues.length > 1).length,
  };

  const body = {
    data: final,
    summary,
    meta: {
      minPnl, minVolume, minWr, minTrades, include, limit,
      sources: ['gmx-arbitrum', 'gmx-avalanche', 'hyperliquid'],
      timestamp: Date.now(),
    },
  };

  cache.set(cacheKey, { body, ts: Date.now() });

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  });
}
