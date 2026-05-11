/**
 * Pure trade-stats math extracted from useRealtimeTrades — testable
 * without a WebSocket or React runtime.
 *
 * Semantics:
 *   - buyVolume / sellVolume / netDelta / tradeCount / tradeSpeed /
 *     bigBuys / bigSells use the WINDOWED set (only trades inside
 *     `windowMs` of `now`).
 *   - cvd / vwap / cvdHistory use the FULL session (all input trades).
 *     This is intentional: CVD is a session-wide accumulator that
 *     gives traders a single anchor regardless of window selection;
 *     VWAP needs all the volume to be meaningful.
 *
 * Input invariant: `trades` is most-recent-first (matches the hook's
 * internal ordering after each push). Older trades are at the tail.
 */

export interface RealtimeTrade {
  time: number;
  price: number;
  qty: number;
  quoteQty: number;
  isBuy: boolean;
}

export interface TradeStats {
  buyVolume: number;
  sellVolume: number;
  netDelta: number;
  tradeCount: number;
  tradeSpeed: number;   // per second
  bigBuys: number;      // count of buy trades >= BIG_TRADE_USD
  bigSells: number;
  cvd: number;          // cumulative volume delta (session)
  vwap: number;         // volume-weighted average price (session)
  cvdHistory: number[]; // sampled running CVD points for sparkline
}

export const BIG_TRADE_USD = 50_000;
const CVD_HISTORY_BUCKETS = 60;

export function computeTradeStats(
  trades: RealtimeTrade[],
  windowMs: number,
  now: number,
  options: { bigTradeUsd?: number; cvdHistoryBuckets?: number } = {},
): TradeStats {
  const bigTradeUsd = options.bigTradeUsd ?? BIG_TRADE_USD;
  const buckets = options.cvdHistoryBuckets ?? CVD_HISTORY_BUCKETS;

  /* Windowed slice for buy/sell roll-ups */
  const filtered = windowMs === Infinity
    ? trades
    : trades.filter(t => now - t.time < windowMs);

  let buyVol = 0, sellVol = 0, bigBuys = 0, bigSells = 0;
  for (const t of filtered) {
    if (t.isBuy) {
      buyVol += t.quoteQty;
      if (t.quoteQty >= bigTradeUsd) bigBuys++;
    } else {
      sellVol += t.quoteQty;
      if (t.quoteQty >= bigTradeUsd) bigSells++;
    }
  }

  /* Trade speed: trades per second within the window. We use the
     oldest-in-window timestamp as the span anchor — this naturally
     compresses when filtering an idle period leaves fewer trades. */
  const oldest = filtered.length > 0 ? filtered[filtered.length - 1].time : now;
  const rawSpan = (now - oldest) / 1000;
  const spanSec = isFinite(rawSpan) && rawSpan > 0 ? rawSpan : 1;

  /* CVD + VWAP from session-wide trades (NOT the window). Iterating
     from tail-forwards mirrors chronological order — though CVD is
     order-invariant since it's a sum.
     VWAP = sum(price × base_qty) / sum(base_qty). Using base `qty`
     (not `quoteQty`) gives the standard definition every trader
     knows from TradingView etc; weighting by quoteQty would
     double-count price and bias VWAP toward higher-priced trades. */
  let cvd = 0, vwapNum = 0, vwapDen = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i];
    cvd += t.isBuy ? t.quoteQty : -t.quoteQty;
    vwapNum += t.price * t.qty;
    vwapDen += t.qty;
  }
  const vwap = vwapDen > 0 ? vwapNum / vwapDen : 0;

  /* CVD history sparkline: walk session trades oldest→newest,
     sampling every `step` points up to `buckets` total. The sparkline
     should show CVD evolving over time, so we keep running balance. */
  const cvdHistory: number[] = [];
  if (trades.length > 0) {
    const step = Math.max(1, Math.floor(trades.length / buckets));
    let runningCvd = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      const t = trades[i];
      runningCvd += t.isBuy ? t.quoteQty : -t.quoteQty;
      if ((trades.length - 1 - i) % step === 0) cvdHistory.push(runningCvd);
    }
  }

  return {
    buyVolume: buyVol,
    sellVolume: sellVol,
    netDelta: buyVol - sellVol,
    tradeCount: filtered.length,
    tradeSpeed: Math.round(filtered.length / spanSec),
    bigBuys,
    bigSells,
    cvd,
    vwap,
    cvdHistory,
  };
}
