/**
 * Hub bot v2 — pull signals for the top-N coins.
 *
 * Aggregates funding + OI + basis data for each symbol in the configured
 * universe and produces `SignalInputs` that `idea-scorer` can consume.
 *
 * For PR2 v1 the implemented signals are:
 *   • Funding rate + cross-symbol percentile approximation
 *   • OI delta (1h/4h/24h) from /api/openinterest?changes=1
 *   • Cross-venue basis spread (max deviation from cohort median)
 *
 * The remaining signals (whale flow, liq-cluster proximity, L/S ratio
 * percentile) are returned as NEUTRAL inputs that the scorer treats as
 * "didn't fire" — they're slated for incremental implementation in PR3
 * without changing the scorer or downstream renderers.
 *
 * Calls our internal aggregators directly (NOT internal HTTP fetches —
 * see CLAUDE.md: "Don't fetch internal `/api/openinterest` style giant
 * payloads to filter one symbol — refactor the underlying logic into
 * `lib/` and import directly").
 */

import {
  fetchAllFundingRates,
  fetchAllOpenInterest,
  fetchOIChanges,
  aggregateOpenInterestBySymbol,
} from '@/lib/api/aggregator';
import type { SignalInputs } from './idea-scorer';

export interface CoinSignals {
  symbol: string;
  currentPrice: number;
  inputs: SignalInputs;
}

/**
 * Returns top-N symbols by aggregate OI, with all known signals filled in
 * and unimplemented signals at neutral defaults. The scorer is fed each
 * (symbol, side) tuple — caller decides whether to score long or short
 * (or both, and pick whichever scores higher).
 */
export async function fetchTopUniverseSignals(limit: number = 50): Promise<CoinSignals[]> {
  const [funding, oi, oiChanges] = await Promise.all([
    fetchAllFundingRates('crypto').catch(() => []),
    fetchAllOpenInterest().catch(() => []),
    fetchOIChanges().catch(() => []),
  ]);

  // Top-N by aggregate OI
  const oiBySymbol = aggregateOpenInterestBySymbol(oi);
  const topSymbols = Array.from(oiBySymbol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([symbol]) => symbol);

  // Build per-symbol funding map (aggregated across venues)
  const fundingBySymbol = new Map<string, number[]>();
  const fundingMarkBySymbol = new Map<string, number>();
  for (const fr of funding) {
    const list = fundingBySymbol.get(fr.symbol) ?? [];
    list.push(fr.fundingRate);
    fundingBySymbol.set(fr.symbol, list);
    if (fr.markPrice && fr.markPrice > 0) {
      // Keep the max mark across venues — usually similar but lets us
      // tolerate one venue being stale
      const prior = fundingMarkBySymbol.get(fr.symbol) ?? 0;
      if (fr.markPrice > prior) fundingMarkBySymbol.set(fr.symbol, fr.markPrice);
    }
  }

  // OI-changes lookup
  const oiChangeBySymbol = new Map<string, { pct4h: number; pct24h: number }>();
  for (const c of oiChanges) {
    const key = c.symbol;
    if (oiChangeBySymbol.has(key)) continue;
    oiChangeBySymbol.set(key, {
      pct4h: typeof c.pct4h === 'number' ? c.pct4h : 0,
      pct24h: typeof c.pct24h === 'number' ? c.pct24h : 0,
    });
  }

  // Cross-symbol funding percentile: rank by |rate| across the universe.
  // Approximation while we wait for 30-day history to land — works fine
  // for the "this coin's funding is unusually extreme TODAY" question.
  const allAbsFundings = topSymbols
    .map((s) => {
      const rates = fundingBySymbol.get(s) ?? [];
      if (rates.length === 0) return { symbol: s, absAvg: 0 };
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      return { symbol: s, absAvg: Math.abs(avg) };
    })
    .sort((a, b) => a.absAvg - b.absAvg);
  const pctileBySymbol = new Map<string, number>();
  allAbsFundings.forEach((entry, idx) => {
    const pctile = ((idx + 1) / allAbsFundings.length) * 100;
    pctileBySymbol.set(entry.symbol, pctile);
  });

  // Compose the signal inputs per symbol
  const out: CoinSignals[] = [];
  for (const symbol of topSymbols) {
    const rates = fundingBySymbol.get(symbol) ?? [];
    if (rates.length === 0) continue;
    const avgFunding = rates.reduce((a, b) => a + b, 0) / rates.length;
    const fundingPctile = pctileBySymbol.get(symbol) ?? 50;

    // Cross-venue basis: max |rate - cohort_median|
    let basisSpread = 0;
    if (rates.length > 1) {
      const sorted = [...rates].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      basisSpread = Math.max(
        ...rates.map((r) => Math.abs(r - median)),
        0,
      );
    }

    const oiChg = oiChangeBySymbol.get(symbol);
    const oiDelta4h = oiChg?.pct4h ?? 0;

    const inputs: SignalInputs = {
      fundingPct: avgFunding,
      fundingPctileAbs: fundingPctile,
      fundingSignFlipped4h: false, // PR3 — needs history table
      whaleNetUsd4h: 0,             // PR3
      whaleCount4h: 0,              // PR3
      oiDelta4hPct: oiDelta4h,
      liqClusterDistPct: 999,       // PR3 — needs per-symbol liq-map call
      basisSpreadMaxPct: basisSpread,
      longShortRatio: 1.0,          // PR3 — only available for top 5 coins
      longShortPctileAbs: 50,
    };

    out.push({
      symbol,
      currentPrice: fundingMarkBySymbol.get(symbol) ?? 0,
      inputs,
    });
  }

  return out;
}

/**
 * Convenience wrapper for unit-test seams — lets us pass a pre-built
 * universe (e.g. fixture data) without hitting upstream APIs.
 */
export function buildCoinSignalsFromRaw(args: {
  fundingBySymbol: Map<string, number[]>;
  oiChangeBySymbol: Map<string, { pct4h: number; pct24h: number }>;
  markBySymbol: Map<string, number>;
  topSymbols: string[];
}): CoinSignals[] {
  const { fundingBySymbol, oiChangeBySymbol, markBySymbol, topSymbols } = args;

  const allAbsFundings = topSymbols
    .map((s) => {
      const rates = fundingBySymbol.get(s) ?? [];
      if (rates.length === 0) return { symbol: s, absAvg: 0 };
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      return { symbol: s, absAvg: Math.abs(avg) };
    })
    .sort((a, b) => a.absAvg - b.absAvg);
  const pctileBySymbol = new Map<string, number>();
  allAbsFundings.forEach((entry, idx) => {
    const pctile = ((idx + 1) / allAbsFundings.length) * 100;
    pctileBySymbol.set(entry.symbol, pctile);
  });

  return topSymbols
    .map((symbol) => {
      const rates = fundingBySymbol.get(symbol) ?? [];
      if (rates.length === 0) return null;
      const avgFunding = rates.reduce((a, b) => a + b, 0) / rates.length;
      let basisSpread = 0;
      if (rates.length > 1) {
        const sorted = [...rates].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        basisSpread = Math.max(...rates.map((r) => Math.abs(r - median)), 0);
      }
      const oiChg = oiChangeBySymbol.get(symbol);
      return {
        symbol,
        currentPrice: markBySymbol.get(symbol) ?? 0,
        inputs: {
          fundingPct: avgFunding,
          fundingPctileAbs: pctileBySymbol.get(symbol) ?? 50,
          fundingSignFlipped4h: false,
          whaleNetUsd4h: 0,
          whaleCount4h: 0,
          oiDelta4hPct: oiChg?.pct4h ?? 0,
          liqClusterDistPct: 999,
          basisSpreadMaxPct: basisSpread,
          longShortRatio: 1.0,
          longShortPctileAbs: 50,
        } as SignalInputs,
      };
    })
    .filter((x): x is CoinSignals => x !== null);
}
