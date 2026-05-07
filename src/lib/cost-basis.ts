/**
 * Cost-basis + realised-PnL aggregator using FIFO accounting.
 *
 * Walks every fill in time order, maintaining a per-(symbol, exchange)
 * lot list. Each closing trade pops lots in FIFO order and accumulates
 * realised PnL. Net result per pair: open lots remaining + realized PnL
 * to date.
 *
 * Uses the user_trades table populated by the sync-positions cron. Pure
 * compute — no IO inside this module beyond reading trades.
 *
 * Tax-relevance: most jurisdictions allow FIFO; some allow specific-id
 * (LIFO/HIFO). For now we ship FIFO; LIFO would just reverse the lot
 * pop order. Easy follow-up.
 */
import type { UserTradeRow } from './db';

export interface CostBasisLot {
  /** Trade row id that opened the lot. */
  openTradeId: string;
  symbol: string;
  exchange: string;
  /** Side: 'long' or 'short' — derived from the opening fill's side+direction. */
  side: 'long' | 'short';
  /** Remaining open size (in coin units). */
  remainingSize: number;
  /** Cost basis per coin (USD). For longs = entry price; for shorts = entry price too. */
  costBasis: number;
  /** Original size at open (size × price). */
  initialValueUsd: number;
  openedAt: Date;
}

export interface CostBasisSummary {
  /** Total realized PnL across all closing trades. */
  realizedPnlUsd: number;
  /** Sum of all fees paid. */
  feesUsd: number;
  /** Net realized = realized − fees (pre-tax). */
  netUsd: number;
  /** Realized PnL in the current calendar year. */
  realizedYtdUsd: number;
  /** Currently-open lots aggregated by (symbol, exchange). */
  openPositions: Array<{
    symbol: string;
    exchange: string;
    side: 'long' | 'short';
    totalSize: number;
    avgCostBasis: number;
    totalCostUsd: number;
    lotCount: number;
  }>;
  /** Top winners + losers by realised PnL. */
  topWinners: Array<{ symbol: string; exchange: string; pnl: number; trades: number }>;
  topLosers: Array<{ symbol: string; exchange: string; pnl: number; trades: number }>;
  /** Realized PnL per calendar year (for tax filing). */
  byYear: Array<{ year: number; realized: number; fees: number; trades: number }>;
}

interface PerPairAccum {
  lots: CostBasisLot[];
  realizedTotal: number;
  realizedYtd: number;
  trades: number;
  /** Per-year buckets {year: realised}. */
  byYear: Map<number, { realized: number; fees: number; trades: number }>;
  feesTotal: number;
}

const KEY = (symbol: string, exchange: string) => `${exchange}|${symbol}`;

/**
 * Run FIFO cost-basis over a chronologically-ordered fill stream.
 * Caller must pass trades sorted by ts ASC.
 */
export function computeCostBasis(trades: UserTradeRow[]): CostBasisSummary {
  const accum = new Map<string, PerPairAccum>();
  const currentYear = new Date().getUTCFullYear();
  let totalFees = 0;

  function getAccum(symbol: string, exchange: string): PerPairAccum {
    const key = KEY(symbol, exchange);
    let a = accum.get(key);
    if (!a) {
      a = { lots: [], realizedTotal: 0, realizedYtd: 0, trades: 0, byYear: new Map(), feesTotal: 0 };
      accum.set(key, a);
    }
    return a;
  }

  for (const t of trades) {
    const a = getAccum(t.symbol, t.exchange);
    a.trades++;

    const fee = t.feeUsd ?? 0;
    if (fee > 0) {
      a.feesTotal += fee;
      totalFees += fee;
    }

    const isOpen = t.direction === 'open' || t.direction === 'add';
    const isClose = t.direction === 'close' || t.direction === 'reduce';
    // Fallback when direction tag is missing: use venue's realizedPnlUsd
    // as the discriminator (closing trades report realized PnL).
    const directionKnown = t.direction != null;
    const treatAsClose = directionKnown ? isClose : (t.realizedPnlUsd != null && t.realizedPnlUsd !== 0);

    // Determine the side this fill is on:
    //   - For derivatives/perps with explicit direction: 'open buy' = long,
    //     'open sell' = short. 'close buy' = closing a short, 'close sell'
    //     = closing a long.
    //   - For spot CEX trades (no direction): each buy creates a long lot,
    //     each sell closes one. Shorts on spot are rare; we treat any
    //     'sell' before a matching 'buy' as a flat-to-short open which
    //     is unusual but OK for tax purposes.
    const isBuySide = t.side === 'buy' || t.side === 'B';

    if (treatAsClose) {
      // Closing: pop lots until we've consumed `t.size` coins. Each lot's
      // cost basis × size_consumed is the basis we deduct from the
      // realised PnL contribution of this fill.
      let remainingToClose = t.size;
      const closingPriceUsd = t.price;
      // Track fee allocation: divide the trade's fee proportionally by
      // size consumed, but only ONCE total — previous version added
      // (fee * consumed/t.size) per lot pop, which sums to fee × N when
      // a fill spans N lots, double/triple-counting fees. Allocate the
      // full fee proportionally as we go and stop accruing when the trade
      // is fully consumed.
      const totalFeeForTrade = fee;
      let feeAllocated = 0;

      while (remainingToClose > 0 && a.lots.length > 0) {
        const lot = a.lots[0];
        const consumed = Math.min(lot.remainingSize, remainingToClose);
        // PnL contribution: long → (closePx - costBasis) × size
        //                   short → (costBasis - closePx) × size
        const pnl = lot.side === 'long'
          ? (closingPriceUsd - lot.costBasis) * consumed
          : (lot.costBasis - closingPriceUsd) * consumed;
        a.realizedTotal += pnl;
        if (t.ts.getUTCFullYear() === currentYear) a.realizedYtd += pnl;
        const yearBucket = a.byYear.get(t.ts.getUTCFullYear()) ?? { realized: 0, fees: 0, trades: 0 };
        yearBucket.realized += pnl;
        yearBucket.trades++;
        // Pro-rate the SAME total fee across consumed slices. Sum across
        // all loop iterations of one fill stays bounded by totalFeeForTrade.
        const feeShare = t.size > 0 ? totalFeeForTrade * (consumed / t.size) : 0;
        yearBucket.fees += feeShare;
        feeAllocated += feeShare;
        a.byYear.set(t.ts.getUTCFullYear(), yearBucket);

        lot.remainingSize -= consumed;
        remainingToClose -= consumed;
        if (lot.remainingSize <= 1e-9) a.lots.shift();
      }
      // Defensive: if the close didn't consume the full size (i.e. there
      // were no opposing lots and we don't open a flip below), still count
      // any remaining fee share against the current year so the user's
      // total fees-paid matches the venue receipt.
      const feeRemainder = totalFeeForTrade - feeAllocated;
      if (feeRemainder > 1e-9) {
        const yb = a.byYear.get(t.ts.getUTCFullYear()) ?? { realized: 0, fees: 0, trades: 0 };
        yb.fees += feeRemainder;
        a.byYear.set(t.ts.getUTCFullYear(), yb);
      }

      // If we tried to close more than we had open lots for, treat the
      // overflow as a position-flip and open a new lot in the OPPOSITE
      // direction. This handles HL's "Long > Short" / "Short > Long" dir.
      if (remainingToClose > 1e-9) {
        const newSide: 'long' | 'short' = isBuySide ? 'long' : 'short';
        a.lots.push({
          openTradeId: t.id,
          symbol: t.symbol,
          exchange: t.exchange,
          side: newSide,
          remainingSize: remainingToClose,
          costBasis: t.price,
          initialValueUsd: remainingToClose * t.price,
          openedAt: t.ts,
        });
      }
    } else {
      // Opening or adding: push a new lot with this fill's price as cost basis.
      const side: 'long' | 'short' = isBuySide ? 'long' : 'short';
      a.lots.push({
        openTradeId: t.id,
        symbol: t.symbol,
        exchange: t.exchange,
        side,
        remainingSize: t.size,
        costBasis: t.price,
        initialValueUsd: t.size * t.price,
        openedAt: t.ts,
      });
    }
  }

  // Build summary outputs.
  let realizedTotal = 0, realizedYtd = 0;
  const yearAgg = new Map<number, { realized: number; fees: number; trades: number }>();
  const openPositions: CostBasisSummary['openPositions'] = [];
  const perPairPnl: Array<{ symbol: string; exchange: string; pnl: number; trades: number }> = [];

  accum.forEach((a, key) => {
    realizedTotal += a.realizedTotal;
    realizedYtd += a.realizedYtd;
    a.byYear.forEach((v, year) => {
      const existing = yearAgg.get(year) ?? { realized: 0, fees: 0, trades: 0 };
      existing.realized += v.realized;
      existing.fees += v.fees;
      existing.trades += v.trades;
      yearAgg.set(year, existing);
    });

    if (a.lots.length > 0) {
      // Aggregate remaining open lots by side. (Within one pair, both
      // sides shouldn't coexist after FIFO close handling, but be defensive.)
      const grouped = new Map<'long' | 'short', { totalSize: number; totalCost: number; lotCount: number }>();
      for (const lot of a.lots) {
        const g = grouped.get(lot.side) ?? { totalSize: 0, totalCost: 0, lotCount: 0 };
        g.totalSize += lot.remainingSize;
        g.totalCost += lot.remainingSize * lot.costBasis;
        g.lotCount++;
        grouped.set(lot.side, g);
      }
      const [exchange, symbol] = key.split('|', 2);
      grouped.forEach((g, side) => {
        if (g.totalSize <= 1e-9) return;
        openPositions.push({
          symbol,
          exchange,
          side,
          totalSize: g.totalSize,
          avgCostBasis: g.totalCost / g.totalSize,
          totalCostUsd: g.totalCost,
          lotCount: g.lotCount,
        });
      });
    }

    if (Math.abs(a.realizedTotal) > 0.01) {
      const [exchange, symbol] = key.split('|', 2);
      perPairPnl.push({ symbol, exchange, pnl: a.realizedTotal, trades: a.trades });
    }
  });

  perPairPnl.sort((a, b) => b.pnl - a.pnl);
  const topWinners = perPairPnl.filter(p => p.pnl > 0).slice(0, 10);
  const topLosers = perPairPnl.filter(p => p.pnl < 0).slice(-10).reverse();

  const byYear = Array.from(yearAgg.entries())
    .map(([year, v]) => ({ year, realized: v.realized, fees: v.fees, trades: v.trades }))
    .sort((a, b) => b.year - a.year);

  return {
    realizedPnlUsd: realizedTotal,
    feesUsd: totalFees,
    netUsd: realizedTotal - totalFees,
    realizedYtdUsd: realizedYtd,
    openPositions: openPositions.sort((a, b) => b.totalCostUsd - a.totalCostUsd),
    topWinners,
    topLosers,
    byYear,
  };
}
