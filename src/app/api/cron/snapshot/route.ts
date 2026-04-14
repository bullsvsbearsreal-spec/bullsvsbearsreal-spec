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
  saveSpreadSnapshot,
  pruneOldData,
  recordAdminMetric,
} from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_SYMBOLS = 200; // Store top 200 symbols — balances coverage vs DB growth

export async function GET(request: NextRequest) {
  // Verify auth — timing-safe comparison
  const { verifyCronAuth } = await import('../_auth');
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();

    const origin = process.env.NEXTAUTH_URL || 'https://info-hub.io';
    // With 1-min cron: only do full funding+OI every 10 min (when minute is 0)
    const minute = new Date().getMinutes();
    const isFullRun = minute % 10 === 0;

    const [fundingRes, oiRes] = isFullRun
      ? await Promise.all([
          fetch(`${origin}/api/funding`, { signal: AbortSignal.timeout(25000) }),
          fetch(`${origin}/api/openinterest`, { signal: AbortSignal.timeout(25000) }),
        ])
      : [null, null];

    let fundingInserted = 0;
    let oiInserted = 0;
    let liqInserted = 0;

    // Process funding rates (only on full runs every 10 min)
    if (fundingRes?.ok) {
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
          predicted: r.predictedRate != null ? Number(r.predictedRate) : undefined,
          markPrice: r.markPrice != null && r.markPrice > 0 ? Number(r.markPrice) : undefined,
        }));

      fundingInserted = await saveFundingSnapshot(fundingEntries);
    }

    // Process open interest (only on full runs every 10 min)
    if (oiRes?.ok) {
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

    // Process spread snapshots from tickers
    let spreadInserted = 0;
    try {
      const tickerRes = await fetch(`${origin}/api/tickers`, { signal: AbortSignal.timeout(15000) });
      if (tickerRes.ok) {
        const tickerJson = await tickerRes.json();
        const tickers: any[] = tickerJson.data || tickerJson || [];
        // Group by symbol, compute spread for top symbols
        const bySymbol: Record<string, { exchange: string; price: number }[]> = {};
        for (const t of tickers) {
          if (!t.lastPrice || t.lastPrice <= 0) continue;
          if (!bySymbol[t.symbol]) bySymbol[t.symbol] = [];
          bySymbol[t.symbol].push({ exchange: t.exchange, price: t.lastPrice });
        }
        // Auto-detect top 50 symbols by exchange count (more exchanges = more relevant for spread tracking)
        const topSyms = Object.entries(bySymbol)
          .filter(([, entries]) => entries.length >= 2)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 50)
          .map(([sym]) => sym);
        for (const sym of topSyms) {
          const entries = bySymbol[sym];
          if (!entries || entries.length < 2) continue;
          entries.sort((a, b) => b.price - a.price);
          const high = entries[0];
          const low = entries[entries.length - 1];
          const spread = high.price - low.price;
          const pct = (spread / low.price) * 100;
          await saveSpreadSnapshot({
            symbol: sym, spreadUsd: spread, spreadPct: pct,
            highExchange: high.exchange, lowExchange: low.exchange,
            highPrice: high.price, lowPrice: low.price,
            exchangeCount: entries.length,
          });
          spreadInserted++;

          // Track arb opportunities
          const arbThreshold = sym === 'BTC' ? 0.3 : 0.5; // % threshold
          try {
            const dbSql = getSQL();
            const openArb = await dbSql`SELECT * FROM arb_opportunities WHERE symbol = ${sym} AND status = 'open' LIMIT 1`;
            if (openArb.length > 0) {
              const arb = openArb[0];
              if (pct > +arb.max_spread_pct) {
                await dbSql`UPDATE arb_opportunities SET max_spread_usd = ${spread}, max_spread_pct = ${pct} WHERE id = ${arb.id}`;
              }
              if (pct < arbThreshold * 0.5) {
                await dbSql`UPDATE arb_opportunities SET status = 'closed', closed_at = NOW() WHERE id = ${arb.id}`;
              }
            } else if (pct > arbThreshold) {
              await dbSql`INSERT INTO arb_opportunities (symbol, spread_usd, spread_pct, high_exchange, low_exchange, max_spread_usd, max_spread_pct) VALUES (${sym}, ${spread}, ${pct}, ${high.exchange}, ${low.exchange}, ${spread}, ${pct})`;
            }
          } catch (arbErr) { /* arb tracking non-critical */ }
        }

        // Store per-exchange prices as mark_price in funding_snapshots every cron run
        // This enables 1D/7D/30D chart lines for ALL exchanges (not just those with kline APIs)
        {
          const priceEntries: Array<{ symbol: string; exchange: string; rate: number; markPrice: number }> = [];
          for (const sym of topSyms) {
            const symEntries = bySymbol[sym];
            if (!symEntries) continue;
            for (const e of symEntries) {
              priceEntries.push({ symbol: sym, exchange: e.exchange, rate: 0, markPrice: e.price });
            }
          }
          if (priceEntries.length > 0) {
            await saveFundingSnapshot(priceEntries);
          }
        }
      }
    } catch (e) {
      console.error('[cron/snapshot] spread error:', e);
    }

    // NOTE: Liquidation ingestion is handled SOLELY by /api/cron/ingest-liquidations (runs every 1m).
    // Previously this snapshot cron also re-inserted 24h of heatmap events every hour, causing
    // ~6x duplicate entries in the DB (events re-inserted with slight timestamp variations
    // bypassing the ON CONFLICT dedup). This inflated totals to $917M vs Coinglass's $141M.
    // Removed 2026-03-18 to fix the overcount. See ingest-liquidations for the sole insertion path.

    // Prune on full runs only (every 10 min)
    // Keep 2 days so the 24h OI delta query (which looks back ~24h10m) has headroom.
    // Previously keepDays=1 deleted snapshots right at the 24h boundary, causing
    // the oi_24h CTE in getOIDeltas to always find zero rows → "No data".
    const pruned = isFullRun ? await pruneOldData(2) : { funding: 0, oi: 0, liquidations: 0 };

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
      runType: isFullRun ? 'full' : 'price-only',
      fundingInserted,
      oiInserted,
      spreadInserted,
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
