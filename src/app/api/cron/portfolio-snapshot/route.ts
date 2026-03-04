/**
 * Cron endpoint: daily portfolio value snapshot.
 * Runs once daily at midnight UTC via Vercel Cron.
 *
 * For each user with portfolio holdings, calculates current total value
 * and P&L, then stores a snapshot for historical tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDB,
  isDBConfigured,
  getUsersWithPortfolios,
  savePortfolioSnapshot,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'sin1';

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

async function fetchJSON<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
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

    // Fetch current prices
    const tickerJson = await fetchJSON<{ data: any[] }>(`${origin}/api/tickers`);
    if (!tickerJson?.data) {
      return NextResponse.json({ ok: true, skipped: 'no ticker data' });
    }

    // Build price map (highest volume per symbol)
    const priceMap = new Map<string, number>();
    for (const t of tickerJson.data) {
      if (t.lastPrice && t.symbol) {
        const existing = priceMap.get(t.symbol);
        if (!existing || t.lastPrice > 0) {
          priceMap.set(t.symbol, t.lastPrice);
        }
      }
    }

    const users = await getUsersWithPortfolios();
    let snapshots = 0;

    for (const user of users) {
      try {
        let totalValue = 0;
        let totalCost = 0;
        const holdings: any[] = [];

        for (const h of user.portfolio) {
          const price = priceMap.get(h.symbol);
          if (!price || !h.quantity) continue;

          const value = price * h.quantity;
          const cost = (h.avgPrice || 0) * h.quantity;
          totalValue += value;
          totalCost += cost;

          holdings.push({
            symbol: h.symbol,
            quantity: h.quantity,
            avgPrice: h.avgPrice || 0,
            currentPrice: price,
            value,
          });
        }

        if (totalValue > 0) {
          const totalPnl = totalValue - totalCost;
          await savePortfolioSnapshot(user.userId, totalValue, totalPnl, holdings);
          snapshots++;
        }
      } catch (err) {
        console.error(`[portfolio-cron] error for user ${user.userId}:`, err);
      }
    }

    return NextResponse.json({ ok: true, users: users.length, snapshots });
  } catch (error) {
    console.error('[portfolio-cron] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
