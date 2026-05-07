/**
 * Strategy Backtest Lab — pure-compute simulator for crypto strategies.
 *
 * Two strategies ship in this v1:
 *
 *   1. DCA (Dollar-Cost Averaging) — invest $X every N days into asset Y
 *      for the past M days. Returns final value, total deposited, ROI,
 *      max drawdown, and a daily portfolio-value series for charting.
 *
 *   2. Funding-Rate Carry — every day, go LONG the perp with the most
 *      negative funding rate (longs get paid) and SHORT the perp with
 *      the most positive funding rate (shorts get paid). Earn the spread
 *      every funding interval. Uses our own funding_snapshots history
 *      (limited to 50 days) since we DON'T have historical funding from
 *      external sources.
 *
 * Pure pure pure: takes data + config, returns result. No IO inside this
 * module beyond the data fetch helpers exposed for the API route.
 */
import { getSQL } from './db';

const TIMEOUT_MS = 12_000;

export interface BacktestPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Portfolio value at end-of-day in USD. */
  valueUsd: number;
  /** Cumulative deposit / capital deployed at this point. */
  depositedUsd: number;
  /** Cumulative return = (value − deposited) / deposited × 100. */
  roiPct: number;
}

export interface BacktestResult {
  strategy: 'dca' | 'funding-carry';
  config: Record<string, any>;
  series: BacktestPoint[];
  /** Summary stats. */
  finalValueUsd: number;
  totalDepositedUsd: number;
  totalReturnPct: number;
  /** Max drawdown over the backtest, % of peak value. */
  maxDrawdownPct: number;
  /** Annualised volatility of daily returns, %. */
  annualisedVolPct: number;
  /** Sharpe-ish ratio: ann. return / ann. vol. Risk-free assumed 0. */
  sharpe: number;
  /** Trade count (deposits, rebalances). */
  trades: number;
  /** ts of compute. */
  ts: number;
}

// ─── DCA backtest ────────────────────────────────────────────────────────────

export interface DcaConfig {
  /** Symbol/asset, lowercase coingecko id (e.g. 'bitcoin', 'ethereum'). */
  asset: string;
  /** USD invested per buy. */
  amountUsd: number;
  /** Days between buys. 1 = daily, 7 = weekly. */
  intervalDays: number;
  /** Lookback in days. Max 365. */
  lookbackDays: number;
}

interface CGMarketChart {
  prices: Array<[number, number]>; // [tsMs, priceUsd]
}

async function fetchCoinGeckoPrices(coinId: string, days: number): Promise<Array<[number, number]>> {
  const interval = days > 90 ? 'daily' : days > 1 ? '' : 'hourly'; // CG free tier rule
  const intervalQs = interval ? `&interval=${interval}` : '';
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}${intervalQs}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
  });
  if (!res.ok) throw new Error(`CoinGecko market_chart HTTP ${res.status}`);
  const json = (await res.json()) as CGMarketChart;
  return json.prices ?? [];
}

/** Bucket raw price points into daily closes. CoinGecko gives more than
 *  one point per day on shorter ranges; we keep the LAST point per day. */
function bucketDaily(points: Array<[number, number]>): Array<{ date: string; price: number; ts: number }> {
  const map = new Map<string, { price: number; ts: number }>();
  for (const [ts, price] of points) {
    if (!Number.isFinite(price) || price <= 0) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
    map.set(date, { price, ts }); // overwrites earlier same-day → keeps last
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Run a DCA simulation. Returns full result with daily portfolio value. */
export async function runDcaBacktest(config: DcaConfig): Promise<BacktestResult> {
  const days = Math.min(Math.max(config.lookbackDays, 7), 365);
  const interval = Math.min(Math.max(config.intervalDays, 1), 30);
  const amount = Math.max(config.amountUsd, 1);

  const raw = await fetchCoinGeckoPrices(config.asset.toLowerCase(), days);
  const daily = bucketDaily(raw);
  if (daily.length < 2) throw new Error(`No price history for ${config.asset}`);

  let units = 0;
  let deposited = 0;
  let trades = 0;
  let lastBuyAtIndex = -interval; // forces buy on day 0
  const series: BacktestPoint[] = [];
  const dailyReturns: number[] = [];
  let prevValue = 0;

  for (let i = 0; i < daily.length; i++) {
    const day = daily[i];
    if (i - lastBuyAtIndex >= interval) {
      // Buy at this day's close.
      const newUnits = amount / day.price;
      units += newUnits;
      deposited += amount;
      trades++;
      lastBuyAtIndex = i;
    }
    const value = units * day.price;
    if (i > 0 && prevValue > 0) {
      dailyReturns.push((value - prevValue) / prevValue);
    }
    series.push({
      date: day.date,
      valueUsd: value,
      depositedUsd: deposited,
      roiPct: deposited > 0 ? ((value - deposited) / deposited) * 100 : 0,
    });
    prevValue = value;
  }

  const finalValue = series[series.length - 1].valueUsd;
  // Max drawdown: largest peak-to-trough drop.
  let peak = 0, maxDd = 0;
  for (const p of series) {
    peak = Math.max(peak, p.valueUsd);
    if (peak > 0) {
      const dd = (peak - p.valueUsd) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  // Annualised volatility from daily returns.
  const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / Math.max(1, dailyReturns.length);
  const variance = dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / Math.max(1, dailyReturns.length);
  const stdDevDaily = Math.sqrt(variance);
  const annVol = stdDevDaily * Math.sqrt(365) * 100;
  const annReturn = meanReturn * 365 * 100;
  const sharpe = annVol > 0 ? annReturn / annVol : 0;

  return {
    strategy: 'dca',
    config,
    series,
    finalValueUsd: finalValue,
    totalDepositedUsd: deposited,
    totalReturnPct: deposited > 0 ? ((finalValue - deposited) / deposited) * 100 : 0,
    maxDrawdownPct: maxDd * 100,
    annualisedVolPct: annVol,
    sharpe,
    trades,
    ts: Date.now(),
  };
}

// ─── Funding-rate carry backtest ─────────────────────────────────────────────

export interface FundingCarryConfig {
  /** Notional per leg in USD. Total exposure = 2 × this. */
  notionalUsd: number;
  /** Min lookback for valid pairs (days). Defaults to 14d. */
  lookbackDays: number;
  /** Asset filter (e.g. 'BTC', 'ETH'). When set, only that symbol's
   *  pairs are considered. When omitted, ALL symbols available are
   *  pooled and the strategy picks the day's best long+short pair. */
  symbol?: string;
}

interface FundingDailyRow {
  date: string;
  symbol: string;
  exchange: string;
  /** Daily-equivalent rate in fraction (e.g. 0.0003 = 0.03%/day). */
  dailyRate: number;
}

/**
 * Pull from funding_snapshots, normalise to daily rate using the venue's
 * actual native interval (1h for HL/dYdX/GMX/Lighter, 4h for Kraken,
 * 8h for most CEXes). Group by (date, symbol, exchange).
 *
 * For carry, we use the storage convention "rate > 0 = longs pay" as is.
 */
async function loadFundingDailies(opts: FundingCarryConfig): Promise<FundingDailyRow[]> {
  const { intervalHoursFor } = await import('./funding-intervals');
  const sql = getSQL();
  const days = Math.min(Math.max(opts.lookbackDays, 3), 50);
  const rows = await sql`
    SELECT
      DATE_TRUNC('day', ts)::date AS day,
      symbol,
      exchange,
      AVG(rate) AS avg_rate
    FROM funding_snapshots
    WHERE ts > NOW() - (${days} || ' days')::interval
      AND rate IS NOT NULL
      AND rate <> 0
      ${opts.symbol ? sql`AND symbol = ${opts.symbol.toUpperCase()}` : sql``}
    GROUP BY 1, 2, 3
    ORDER BY 1 ASC
  `;
  // Convert per-interval rate (%) to daily fraction using each venue's
  // actual native interval. HL/dYdX/GMX/Lighter at 1h compound 24× per
  // day; Binance/Bybit/OKX at 8h compound 3×. Previously this was hard-
  // coded to 8h which UNDER-counted HL by 8× — significant since HL
  // dominates the leaderboard data.
  return (rows as any[]).map(r => {
    const intervalH = intervalHoursFor(r.exchange);
    const ratePerInterval = Number(r.avg_rate) / 100;
    return {
      date: typeof r.day === 'string' ? r.day : r.day.toISOString().slice(0, 10),
      symbol: r.symbol,
      exchange: r.exchange,
      dailyRate: ratePerInterval * (24 / intervalH),
    };
  });
}

/**
 * Funding-carry backtest. Every day:
 *   1. Find the (symbol, venue) pair with the most NEGATIVE rate (longs
 *      collect) — go LONG with `notionalUsd`.
 *   2. Find the most POSITIVE rate (shorts collect) — go SHORT with
 *      `notionalUsd`.
 *   3. PnL for the day = notionalUsd × (-bestLongRate + bestShortRate)
 *      (both should be positive contributions when rates favour the
 *      strategy).
 *
 * Ignores: trading fees, slippage, basis risk, position management.
 * Returns annualised cumulative spread over the backtest period.
 */
export async function runFundingCarryBacktest(config: FundingCarryConfig): Promise<BacktestResult> {
  const dailies = await loadFundingDailies(config);
  if (dailies.length === 0) {
    throw new Error('No funding-snapshot data in backtest window');
  }

  // Group by date.
  const byDate = new Map<string, FundingDailyRow[]>();
  for (const r of dailies) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }
  const dates = Array.from(byDate.keys()).sort();

  let cumulative = 0;
  // Track peak as the highest cumulative value seen so far; allow it to be
  // negative at the start of the run so a strategy that loses money on day 1
  // still records the drawdown from that peak (vs the previous version which
  // initialised peak=0 and skipped negative-cumulative days entirely, hiding
  // early losses from maxDrawdownPct).
  let peak = -Infinity;
  let maxDd = 0;
  const dailyReturns: number[] = [];
  const series: BacktestPoint[] = [];
  let trades = 0;

  for (const date of dates) {
    const rows = byDate.get(date)!;
    if (rows.length < 2) continue;

    // Most-negative rate → longs get paid this much
    const sorted = [...rows].sort((a, b) => a.dailyRate - b.dailyRate);
    const longLeg = sorted[0];
    const shortLeg = sorted[sorted.length - 1];
    if (longLeg.dailyRate >= shortLeg.dailyRate) continue;

    // Daily PnL = capital × (-longRate + shortRate). longRate is negative
    // (we benefit), shortRate is positive (we benefit).
    const pnl = config.notionalUsd * (-longLeg.dailyRate + shortLeg.dailyRate);
    cumulative += pnl;
    trades += 2; // open + close per leg per day, simplified

    peak = Math.max(peak, cumulative);
    // Use notional as the denominator so DD is a % of capital at risk.
    // (peak − cumulative) is the absolute USD drop from the high-water
    // mark; dividing by notional gives a comparable %.
    const ddUsd = peak - cumulative;
    const dd = config.notionalUsd > 0 ? ddUsd / config.notionalUsd : 0;
    if (dd > maxDd) maxDd = dd;

    if (series.length > 0) {
      const prev = series[series.length - 1].valueUsd;
      if (prev !== 0) dailyReturns.push(pnl / config.notionalUsd);
    }

    series.push({
      date,
      valueUsd: cumulative,
      depositedUsd: config.notionalUsd, // capital is constant; "deposited" represents capital at risk
      roiPct: config.notionalUsd > 0 ? (cumulative / config.notionalUsd) * 100 : 0,
    });
  }

  const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / Math.max(1, dailyReturns.length);
  const variance = dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / Math.max(1, dailyReturns.length);
  const stdDevDaily = Math.sqrt(variance);
  const annVol = stdDevDaily * Math.sqrt(365) * 100;
  const annReturn = meanReturn * 365 * 100;
  const sharpe = annVol > 0 ? annReturn / annVol : 0;

  return {
    strategy: 'funding-carry',
    config,
    series,
    finalValueUsd: cumulative,
    totalDepositedUsd: config.notionalUsd,
    totalReturnPct: config.notionalUsd > 0 ? (cumulative / config.notionalUsd) * 100 : 0,
    maxDrawdownPct: maxDd * 100,
    annualisedVolPct: annVol,
    sharpe,
    trades,
    ts: Date.now(),
  };
}
