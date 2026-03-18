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
    const [fundingRes, oiRes] = await Promise.all([
      fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(25000) }),
      fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(25000) }),
      // Liquidation heatmap fetch removed — ingestion handled by /api/cron/ingest-liquidations
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

    // NOTE: Liquidation ingestion is handled SOLELY by /api/cron/ingest-liquidations (runs every 1m).
    // Previously this snapshot cron also re-inserted 24h of heatmap events every hour, causing
    // ~6x duplicate entries in the DB (events re-inserted with slight timestamp variations
    // bypassing the ON CONFLICT dedup). This inflated totals to $917M vs Coinglass's $141M.
    // Removed 2026-03-18 to fix the overcount. See ingest-liquidations for the sole insertion path.

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
