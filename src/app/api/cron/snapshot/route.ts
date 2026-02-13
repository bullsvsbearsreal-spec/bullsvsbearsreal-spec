/**
 * Cron endpoint: takes a snapshot of funding rates and open interest every 10 minutes.
 * Called by Vercel Cron or external cron service.
 *
 * Security: Verifies CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDB,
  isDBConfigured,
  saveFundingSnapshot,
  saveOISnapshot,
  pruneOldData,
} from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || '';
const MAX_SYMBOLS = 100; // Only store top 100 symbols to control storage

export async function GET(request: NextRequest) {
  // Verify auth — Vercel cron sends Authorization: Bearer <CRON_SECRET>
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
    ]);

    let fundingInserted = 0;
    let oiInserted = 0;

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
        .filter((r: any) => topSymbols.has(r.symbol) && r.openInterest > 0)
        .map((r: any) => ({
          symbol: r.symbol,
          exchange: r.exchange,
          oiUsd: r.openInterest,
        }));

      oiInserted = await saveOISnapshot(oiEntries);
    }

    // Prune old data (infrequently — ~1 in 6 runs, roughly once an hour)
    let pruned = { funding: 0, oi: 0 };
    if (Math.random() < 0.17) {
      pruned = await pruneOldData(90);
    }

    return NextResponse.json({
      ok: true,
      fundingInserted,
      oiInserted,
      pruned: pruned.funding + pruned.oi > 0 ? pruned : undefined,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Cron snapshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
