/**
 * Cron endpoint: takes a snapshot of funding rates and open interest every hour.
 * Called by Vercel Cron or external cron service.
 *
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDB,
  isDBConfigured,
  getSQL,
  saveFundingSnapshot,
  saveOISnapshot,
  saveLiquidationSnapshot,
  pruneOldData,
  recordAdminMetric,
} from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();
const MAX_SYMBOLS = 200; // Store top 200 symbols — balances coverage vs DB growth

export async function GET(request: NextRequest) {
  // Verify auth — Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();

    const origin = request.nextUrl.origin;
    const [fundingRes, oiRes, liqHeatmapRes] = await Promise.all([
      fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(25000) }),
      fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(25000) }),
      fetch(`${origin}/api/liquidation-heatmap?symbol=BTC&timeframe=24h`, { signal: AbortSignal.timeout(15000) }).catch(() => null),
    ]);

    let fundingInserted = 0;
    let oiInserted = 0;
    let liqInserted = 0;

    // Process funding rates
    if (fundingRes.ok) {
      const fundingJson = await fundingRes.json();
      const fundingData: any[] = fundingJson.data || [];

      // Pick top symbols by exchange count
      const symbolCounts: Record<string, number> = {};
      fundingData.forEach((r: any) => {
        symbolCounts[r.symbol] = (symbolCounts[r.symbol] || 0) + 1;
      });
      const topSymbols = new Set(
        Object.entries(symbolCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_SYMBOLS)
          .map(([sym]) => sym)
      );

      const fundingEntries = fundingData
        .filter((r: any) => topSymbols.has(r.symbol) && r.fundingRate != null)
        .map((r: any) => ({
          symbol: r.symbol,
          exchange: r.exchange,
          rate: r.fundingRate,
          predicted: r.predictedRate ?? undefined,
          markPrice: r.markPrice ?? undefined,
        }));

      fundingInserted = await saveFundingSnapshot(fundingEntries);
    }

    // Process open interest
    if (oiRes.ok) {
      const oiJson = await oiRes.json();
      const oiData: any[] = oiJson.data || [];

      // Pick top symbols by exchange count
      const symbolCounts: Record<string, number> = {};
      oiData.forEach((r: any) => {
        symbolCounts[r.symbol] = (symbolCounts[r.symbol] || 0) + 1;
      });
      const topSymbols = new Set(
        Object.entries(symbolCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_SYMBOLS)
          .map(([sym]) => sym)
      );

      const oiEntries = oiData
        .filter((r: any) => topSymbols.has(r.symbol) && r.openInterestValue > 0)
        .map((r: any) => ({
          symbol: r.symbol,
          exchange: r.exchange,
          oiUsd: r.openInterestValue,
        }));

      oiInserted = await saveOISnapshot(oiEntries);
    }

    // Process liquidations from heatmap API (BTC + ETH + SOL)
    if (liqHeatmapRes && liqHeatmapRes.ok) {
      try {
        const liqJson = await liqHeatmapRes.json();
        const recentEvents: any[] = liqJson?.summary?.recentEvents || [];
        const symbol = liqJson?.symbol || 'BTC';

        if (recentEvents.length > 0) {
          const liqEntries = recentEvents
            .filter((e: any) => e.volume > 0 && e.price > 0)
            .map((e: any) => ({
              symbol,
              exchange: e.exchange || 'Unknown',
              side: (e.side || 'long') as 'long' | 'short',
              price: e.price,
              quantity: e.volume / e.price,
              valueUsd: e.volume,
              timestamp: e.time,
            }));
          liqInserted += await saveLiquidationSnapshot(liqEntries);
        }
      } catch (liqErr) {
        console.error('Liquidation snapshot error:', liqErr);
      }
    }

    // Also fetch ETH + SOL liquidations
    for (const sym of ['ETH', 'SOL']) {
      try {
        const res = await fetch(`${origin}/api/liquidation-heatmap?symbol=${sym}&timeframe=24h`, {
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const json = await res.json();
          const events: any[] = json?.summary?.recentEvents || [];
          if (events.length > 0) {
            const entries = events
              .filter((e: any) => e.volume > 0 && e.price > 0)
              .map((e: any) => ({
                symbol: sym,
                exchange: e.exchange || 'Unknown',
                side: (e.side || 'long') as 'long' | 'short',
                price: e.price,
                quantity: e.volume / e.price,
                valueUsd: e.volume,
                timestamp: e.time,
              }));
            liqInserted += await saveLiquidationSnapshot(entries);
          }
        }
      } catch {
        // non-critical, continue
      }
    }

    // Prune old data every run — keep 7 days max to stay within DB limits
    const pruned = await pruneOldData(7);

    // Record DB size for admin monitoring (~1 in 6 runs, roughly hourly)
    if (Math.random() < 0.17) {
      try {
        const sql = getSQL();
        const [{ size_bytes }] = await sql`SELECT pg_database_size(current_database()) AS size_bytes`;
        await recordAdminMetric('db_size', Number(size_bytes));
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      ok: true,
      fundingInserted,
      oiInserted,
      liqInserted,
      pruned: pruned.funding + pruned.oi + pruned.liquidations > 0 ? pruned : undefined,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Cron snapshot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
