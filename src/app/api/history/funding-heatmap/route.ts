/**
 * GET /api/history/funding-heatmap?days=7
 *
 * Returns daily-average funding rates for top symbols.
 * Used by the Funding Heatmap (Time-Series) page.
 *
 * Steps:
 * 1. Fetch current funding rates to determine top symbols by OI
 * 2. Bulk-fetch daily funding history for those symbols
 * 3. Return { symbols, days, data }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBulkFundingHistory, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const TOP_N = 40;

export async function GET(request: NextRequest) {
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const days = Math.min(parseInt(searchParams.get('days') || '7') || 7, 30);

  // Get top symbols from live funding data
  const origin = new URL(request.url).origin;
  let symbols: string[] = [];

  try {
    const fundingRes = await fetch(`${origin}/api/funding`).then((r) => r.ok ? r.json() : null);
    if (fundingRes?.data) {
      // Gather unique symbols, prioritize by appearing on most exchanges
      const symbolCounts = new Map<string, number>();
      (fundingRes.data as any[]).forEach((item: any) => {
        const sym = item.symbol as string;
        symbolCounts.set(sym, (symbolCounts.get(sym) || 0) + 1);
      });
      // Sort by exchange count descending, take top N
      const sorted: string[] = [];
      symbolCounts.forEach((count, sym) => sorted.push(sym));
      sorted.sort((a, b) => (symbolCounts.get(b) || 0) - (symbolCounts.get(a) || 0));
      symbols = sorted.slice(0, TOP_N);
    }
  } catch {
    // Fallback to well-known symbols
    symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'];
  }

  if (symbols.length === 0) {
    return NextResponse.json({ symbols: [], days, data: {} });
  }

  const historyMap = await getBulkFundingHistory(symbols, days);

  // Convert Map to plain object for JSON
  const data: Record<string, Array<{ day: string; rate: number }>> = {};
  historyMap.forEach((points, sym) => {
    data[sym] = points;
  });

  return NextResponse.json({
    symbols,
    days,
    data,
  });
}
