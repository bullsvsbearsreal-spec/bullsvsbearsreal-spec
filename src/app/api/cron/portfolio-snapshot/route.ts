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
  upsertWorkerHeartbeat,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const preferredRegion = 'bom1';


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
  const { verifyCronAuth } = await import('../_auth');
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const origin = process.env.NEXTAUTH_URL || 'https://info-hub.io';

    // Fetch current prices
    const tickerJson = await fetchJSON<{ data: any[] }>(`${origin}/api/tickers`);
    if (!tickerJson?.data) {
      return NextResponse.json({ ok: true, skipped: 'no ticker data' });
    }

    // Build price map — keep highest-volume exchange per symbol
    const priceEntries = new Map<string, { price: number; vol: number }>();
    for (const t of tickerJson.data) {
      if (t.lastPrice && t.symbol) {
        const vol = t.quoteVolume24h || 0;
        const existing = priceEntries.get(t.symbol);
        if (!existing || vol > existing.vol) {
          priceEntries.set(t.symbol, { price: t.lastPrice, vol });
        }
      }
    }
    const priceMap = new Map<string, number>();
    priceEntries.forEach((v, k) => priceMap.set(k, v.price));

    const users = await getUsersWithPortfolios();
    let snapshots = 0;
    let userErrors = 0;

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
        userErrors += 1;
      }
    }

    // Daily cron — no heartbeat meant a broken Yahoo/CoinGecko price feed
    // or DB savePortfolioSnapshot error would silently kill the user's
    // portfolio history with zero ops signal. Heartbeat flips to
    // 'degraded' on any per-user error.
    await upsertWorkerHeartbeat(
      'cron:portfolio-snapshot',
      userErrors === 0 ? 'ok' : 'degraded',
      { users: users.length, snapshots, userErrors },
    ).catch(e => console.error('[portfolio-cron] heartbeat error:', e));

    return NextResponse.json({ ok: true, users: users.length, snapshots });
  } catch (error) {
    console.error('[portfolio-cron] error:', error);
    await upsertWorkerHeartbeat('cron:portfolio-snapshot', 'degraded', {
      error: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    }).catch(() => { /* heartbeat best-effort */ });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
