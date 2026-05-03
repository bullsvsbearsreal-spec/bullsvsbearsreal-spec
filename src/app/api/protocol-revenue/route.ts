/**
 * GET /api/protocol-revenue
 *
 * Protocol fee leaderboard from DeFiLlama's public /overview/fees endpoint.
 * Ranks protocols by 24h / 7d / 30d fee revenue with category breakdowns.
 * Useful for fundamental analysis — which apps are actually making money.
 *
 * Query params:
 *   category   — 'all' | 'Dexs' | 'Derivatives' | 'Lending' | 'Chain' | 'Stablecoin Issuer' (default: 'all')
 *   timeframe  — '24h' | '7d' | '30d' (default: 24h — controls sort)
 *   limit      — max protocols returned (default: 50)
 *
 * Cache: 5 min (DeFiLlama's data updates hourly; no point hammering).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const DEFILLAMA_FEES_URL = 'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';

interface LlamaProtocol {
  name: string;
  defillamaId: string;
  category: string;
  logo?: string;
  chains?: string[];
  total24h?: number;
  total7d?: number;
  total30d?: number;
  total1y?: number;
  totalAllTime?: number;
  change_1d?: number;
  change_7d?: number;
  change_30d?: number;
}

export interface RevenueRow {
  name: string;
  category: string;
  logo: string | null;
  chains: string[];
  fees24h: number;
  fees7d: number;
  fees30d: number;
  change1d: number;      // pct
  change7d: number;
  change30d: number;
  /** 24h fees annualized — simple 24h × 365 */
  annualizedRevenue: number;
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 300_000;  // 5 min

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = (searchParams.get('category') || 'all').trim();
  const timeframe = (searchParams.get('timeframe') || '24h') as '24h' | '7d' | '30d';
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

  const cacheKey = `protocol-revenue:${category}:${timeframe}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const res = await fetch(DEFILLAMA_FEES_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `DeFiLlama ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();

    const raw: LlamaProtocol[] = json?.protocols || [];
    let rows: RevenueRow[] = raw.map(p => ({
      name: p.name,
      category: p.category || 'Other',
      logo: p.logo ?? null,
      chains: p.chains ?? [],
      fees24h: p.total24h ?? 0,
      fees7d: p.total7d ?? 0,
      fees30d: p.total30d ?? 0,
      change1d: p.change_1d ?? 0,
      change7d: p.change_7d ?? 0,
      change30d: p.change_30d ?? 0,
      annualizedRevenue: (p.total24h ?? 0) * 365,
    }));

    // Filter by category (case-insensitive contains for flexibility)
    if (category !== 'all') {
      const catLower = category.toLowerCase();
      rows = rows.filter(r => r.category.toLowerCase().includes(catLower));
    }

    // Sort by chosen timeframe
    const sortKey = timeframe === '24h' ? 'fees24h' : timeframe === '7d' ? 'fees7d' : 'fees30d';
    rows.sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));

    // Build category list (pre-filter) for the UI dropdown
    const categoryCounts = new Map<string, number>();
    for (const r of raw) {
      const c = r.category || 'Other';
      categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
    }
    const categories = Array.from(categoryCounts.entries())
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    const trimmed = rows.slice(0, limit);

    const summary = {
      total24h: trimmed.reduce((s, r) => s + r.fees24h, 0),
      total7d: trimmed.reduce((s, r) => s + r.fees7d, 0),
      total30d: trimmed.reduce((s, r) => s + r.fees30d, 0),
      protocolCount: rows.length,
      topProtocol: trimmed[0]?.name ?? null,
      topFees24h: trimmed[0]?.fees24h ?? 0,
    };

    const body = {
      data: trimmed,
      summary,
      meta: {
        source: 'defillama',
        category,
        timeframe,
        timestamp: Date.now(),
        categories,
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[protocol-revenue] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
