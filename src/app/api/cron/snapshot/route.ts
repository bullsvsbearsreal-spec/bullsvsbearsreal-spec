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
  upsertWorkerHeartbeat,
} from '@/lib/db';
import { getFundingData } from '../../_shared/funding-core';
import { getOIData } from '../../_shared/oi-core';
import { fetchWithTimeout, normalizeSymbol } from '../../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../../_shared/exchange-fetchers';
import { dedupedFetch } from '../../_shared/inflight';
import { tickerFetchers } from '../../tickers/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
// Bumped 30→55s after wiring runWatchTick onto the tail of every
// snapshot run. Snapshot itself stays well under 30s; the watch tick
// is ~400ms per watched wallet so the 25-cap couldn't push past 55s.
export const maxDuration = 55;

// Top symbols by # of exchanges that list them. Bumped from 200 → 500 so that
// long-tail DEX-only / synthetic-only listings (e.g. ORDI / TAO / PENGU on
// GMX, MOODENG / kPEPE on HL) make it into funding_snapshots — otherwise
// /positions can't show the live/24h/48h funding columns for those rows.
const MAX_SYMBOLS = 500;

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

    // With 1-min cron: only do full funding+OI every 10 min (when minute is 0)
    const minute = new Date().getMinutes();
    const isFullRun = minute % 10 === 0;

    // Fetch data directly (no self-referential HTTP — avoids serverless deadlocks)
    const [fundingResult, oiResult] = isFullRun
      ? await Promise.all([
          getFundingData('crypto').catch(() => null),
          getOIData().catch(() => null),
        ])
      : [null, null];

    let fundingInserted = 0;
    let oiInserted = 0;
    let liqInserted = 0;

    // Process funding rates (only on full runs every 10 min)
    if (fundingResult) {
      const fundingData: any[] = fundingResult.result.data || [];

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
        .map((r: any) => {
          // Skew-based DEXes (GMX V2, gTrade) report asymmetric per-side
          // rates. Our shared "longs pay" convention stores the long rate
          // in `rate`; we derive the short-pay rate from fundingRateShort
          // (which is in EARNING convention, positive=that side earns) by
          // negating: shorts-pay = -fundingRateShort.
          // Only set when materially different from rate to avoid bloat.
          let rateShort: number | undefined;
          const longEarn = typeof r.fundingRateLong === 'number' ? r.fundingRateLong : null;
          const shortEarn = typeof r.fundingRateShort === 'number' ? r.fundingRateShort : null;
          if (longEarn != null && shortEarn != null) {
            const shortPay = -shortEarn;
            // For symmetric venues shortPay ≈ rate (longs pay = shorts receive
            // and vice versa). Persist only when the magnitudes differ
            // meaningfully (>10% relative or >0.0005% absolute) — that's the
            // signal of a skew-DEX with OI-weighted asymmetry.
            const baseAbs = Math.abs(r.fundingRate);
            const diff = Math.abs(shortPay - r.fundingRate);
            if (diff > 0.0005 || (baseAbs > 0 && diff / baseAbs > 0.10)) {
              rateShort = shortPay;
            }
          }
          return {
            symbol: r.symbol,
            exchange: r.exchange,
            rate: r.fundingRate,
            rateShort,
            predicted: r.predictedRate != null ? Number(r.predictedRate) : undefined,
            markPrice: r.markPrice != null && r.markPrice > 0 ? Number(r.markPrice) : undefined,
          };
        });

      fundingInserted = await saveFundingSnapshot(fundingEntries);
    }

    // Process open interest (only on full runs every 10 min)
    if (oiResult) {
      const oiData: any[] = oiResult.result.data || [];

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

    // Process spread snapshots from tickers (direct call, no self-referential HTTP)
    let spreadInserted = 0;
    try {
      const tickersResult = await dedupedFetch('tickers', () =>
        fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout),
      );
      if (tickersResult?.data) {
        const tickers: any[] = tickersResult.data;
        tickers.forEach((e: any) => { e.symbol = normalizeSymbol(e.symbol); });
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
        // Compute spreads + arb deltas for all top symbols in memory
        // first, then ONE batched DB read for open arbs, then sequential
        // writes. Was previously 50 × (1 SELECT + 0-1 UPDATE/INSERT) =
        // up to 100 round-trips per minute serialized inside the cron.
        interface SymCalc {
          sym: string;
          high: { exchange: string; price: number };
          low: { exchange: string; price: number };
          spread: number;
          pct: number;
          exchangeCount: number;
          arbThreshold: number;
        }
        const calcs: SymCalc[] = [];
        for (const sym of topSyms) {
          const entries = bySymbol[sym];
          if (!entries || entries.length < 2) continue;
          entries.sort((a, b) => b.price - a.price);
          const high = entries[0];
          const low = entries[entries.length - 1];
          const spread = high.price - low.price;
          const pct = low.price > 0 ? (spread / low.price) * 100 : 0;
          calcs.push({
            sym, high, low, spread, pct,
            exchangeCount: entries.length,
            arbThreshold: sym === 'BTC' ? 0.3 : 0.5,
          });
        }

        // Spread snapshots — ordered, but the helper itself is one INSERT
        // each. This was already O(N) and is fine; it's the arb tracking
        // below that was N+1.
        for (const c of calcs) {
          await saveSpreadSnapshot({
            symbol: c.sym, spreadUsd: c.spread, spreadPct: c.pct,
            highExchange: c.high.exchange, lowExchange: c.low.exchange,
            highPrice: c.high.price, lowPrice: c.low.price,
            exchangeCount: c.exchangeCount,
          });
          spreadInserted++;
        }

        // Arb opportunities: single SELECT for ALL symbols, then in-memory
        // diff to plan UPDATE/INSERT/CLOSE actions. Bulk apply.
        try {
          const dbSql = getSQL();
          const symList = calcs.map(c => c.sym);
          const openArbs = symList.length === 0 ? [] : await dbSql`
            SELECT id, symbol, max_spread_pct
            FROM arb_opportunities
            WHERE status = 'open' AND symbol = ANY(${dbSql.array(symList)}::text[])
          ` as Array<{ id: number; symbol: string; max_spread_pct: number }>;
          const openBySym = new Map<string, { id: number; max_spread_pct: number }>();
          for (const a of openArbs) openBySym.set(a.symbol, { id: a.id, max_spread_pct: Number(a.max_spread_pct) });

          // Plan + execute in sequence. The writes themselves can't easily
          // be one giant statement because the action varies per row.
          for (const c of calcs) {
            const open = openBySym.get(c.sym);
            if (open) {
              if (c.pct > open.max_spread_pct) {
                await dbSql`UPDATE arb_opportunities SET max_spread_usd = ${c.spread}, max_spread_pct = ${c.pct} WHERE id = ${open.id}`;
              }
              if (c.pct < c.arbThreshold * 0.5) {
                await dbSql`UPDATE arb_opportunities SET status = 'closed', closed_at = NOW() WHERE id = ${open.id}`;
              }
            } else if (c.pct > c.arbThreshold) {
              await dbSql`INSERT INTO arb_opportunities (symbol, spread_usd, spread_pct, high_exchange, low_exchange, max_spread_usd, max_spread_pct) VALUES (${c.sym}, ${c.spread}, ${c.pct}, ${c.high.exchange}, ${c.low.exchange}, ${c.spread}, ${c.pct})`;
            }
          }
        } catch (arbErr) {
          // Arb tracking is non-critical — log and continue. Was silent
          // before; the cron monitor missed regressions in this branch.
          console.warn('[cron/snapshot] arb tracking failed:', arbErr instanceof Error ? arbErr.message : arbErr);
        }

        // Store per-exchange prices as mark_price in funding_snapshots every cron run
        // This enables 1D/7D/30D chart lines for ALL exchanges (not just those with kline APIs).
        // CRITICAL: rate is null on these rows — they're price-only, not funding ticks.
        // Storing rate=0 used to pollute the "latest funding rate" lookup on /positions
        // because the once-a-minute price writes outnumbered real once-per-10-min funding
        // writes by 10:1, dragging displayed rates / averages toward zero.
        {
          const priceEntries: Array<{ symbol: string; exchange: string; rate: number | null; markPrice: number }> = [];
          for (const sym of topSyms) {
            const symEntries = bySymbol[sym];
            if (!symEntries) continue;
            for (const e of symEntries) {
              priceEntries.push({ symbol: sym, exchange: e.exchange, rate: null, markPrice: e.price });
            }
          }
          if (priceEntries.length > 0) {
            await saveFundingSnapshot(priceEntries as any);
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

    await upsertWorkerHeartbeat('cron:snapshot', 'ok', {
      runType: isFullRun ? 'full' : 'price-only',
      fundingInserted, oiInserted, spreadInserted,
    }).catch(e => console.error('[cron:snapshot] heartbeat error:', e));

    // ── Tail-call: piggyback the wallet watcher onto the existing 60s
    // snapshot timer so /watch alerts fire without needing a separate
    // systemd timer entry on the droplet. Direct lib call (not an HTTP
    // self-fetch) so we get reliable execution + clean error handling
    // and satisfy CLAUDE.md's "don't fetch your own routes" rule.
    // Awaited so DO Node.js doesn't kill the request before the work
    // completes; runWatchTick on a single watched address is ~400ms,
    // well within the maxDuration budget.
    try {
      const { runWatchTick } = await import('@/lib/hl-watch-runner');
      const watchStats = await runWatchTick();
      // Skipped runs (cooldown / in-flight) are NOT errors — only log
      // when the tick actually ran and something failed inside it.
      if (!watchStats.skipped && watchStats.errors.length > 0) {
        console.warn('[cron:snapshot→watch] errors:', watchStats.errors.slice(0, 3).join(' | '));
      }
    } catch (e) {
      console.warn('[cron:snapshot→watch] runner threw:', e instanceof Error ? e.message : e);
    }

    // Daily prune of stale watch events (~1 in 1440 ticks → roughly once
    // every 24h). Snapshot fires every 60s, so this gates to a single
    // prune per day in expectation. Random gate avoids every cron in
    // the fleet pruning at the same moment.
    if (Math.random() < 1 / 1440) {
      try {
        const { pruneOldWatchData } = await import('@/lib/db');
        const pruned = await pruneOldWatchData(90);
        if (pruned.events + pruned.notifications > 0) {
          await recordAdminMetric('watch_pruned_events', pruned.events).catch(() => {});
          await recordAdminMetric('watch_pruned_notifications', pruned.notifications).catch(() => {});
        }
      } catch (e) {
        console.warn('[cron:snapshot→prune] error:', e instanceof Error ? e.message : e);
      }
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
