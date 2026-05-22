/**
 * Pure event detectors for the auto-tweet system. Each takes a snapshot
 * of relevant data and returns 0+ AutoTweetEvents that crossed
 * tweet-worthy thresholds. Thresholds are tuned to be selective — we
 * want ~5-15 tweets per day, not a firehose.
 */

import type {
  AutoTweetEvent,
  FundingSnapshot,
  OIDataPoint,
  LiquidationDataPoint,
} from './types';

/* ─── Thresholds (tunable) ────────────────────────────────────────── */

export const THRESHOLDS = {
  /** Funding rate magnitude (8h-normalised, fractional) that triggers a
   *  funding-extreme tweet. 0.001 = 0.1% per 8h = ~109% annualized. */
  fundingExtreme: 0.001,
  /** OI delta % over 1h that triggers an oi-spike tweet. */
  oiSpikePct: 5,
  /** Symbols we consider "majors" for OI alerts — we don't want to
   *  tweet every $50M shitcoin's 5% OI swing. */
  oiSpikeMinUsd: 500_000_000,
  /** USD liquidated in the 5-min cascade window. */
  liqCascadeUsd: 10_000_000,
};

/** Whitelist of "major" venues for funding alerts. Reading a funding
 *  extreme from a venue with $200K OI isn't tweet-worthy. */
const MAJOR_FUNDING_VENUES = new Set([
  'Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC', 'Hyperliquid', 'dYdX',
  'Coinbase', 'Deribit', 'BingX', 'Kraken',
]);

/** Whitelist of symbols we care about for funding alerts. We can expand
 *  this later but starting tight avoids flooding @infohub with alerts
 *  for thinly-traded long-tail tokens. */
const MAJOR_FUNDING_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX', 'LINK', 'MATIC',
  'HYPE', 'SUI', 'TON', 'NEAR', 'APT', 'ATOM', 'ADA',
]);

/** Normalise any-interval funding rate to its 8h equivalent so all
 *  detectors compare apples-to-apples.
 *
 *  `intervalH` is the precise per-symbol hours from funding_snapshots
 *  (1, 2, 4, 8, 24). Prefer it when set — Blofin's 24h pairs need
 *  the explicit divisor since the enum bucket maxes out at 8h. The
 *  enum-only fallback handles older snapshot rows from before
 *  interval_h was populated. */
function normalize8h(rate: number, interval: string | null, intervalH?: number | null): number {
  if (intervalH != null && Number.isFinite(intervalH) && intervalH > 0) {
    return rate * (8 / intervalH);
  }
  if (interval === '1h') return rate * 8;
  if (interval === '4h') return rate * 2;
  return rate; // 8h or unknown — treat as already 8h
}

/* ─── 1. Funding extreme ──────────────────────────────────────────── */

export function detectFundingExtremes(
  snapshots: FundingSnapshot[],
  nowMs: number = Date.now(),
): AutoTweetEvent[] {
  const out: AutoTweetEvent[] = [];

  for (const s of snapshots) {
    if (!MAJOR_FUNDING_SYMBOLS.has(s.symbol)) continue;
    if (!MAJOR_FUNDING_VENUES.has(s.exchange)) continue;
    if (!Number.isFinite(s.rate)) continue;

    const rate8h = normalize8h(s.rate, s.fundingInterval, s.intervalHours);
    if (Math.abs(rate8h) < THRESHOLDS.fundingExtreme) continue;

    // Bucket eventId by 8h window so we don't re-tweet the same
    // funding-extreme reading every 5 min while it persists.
    const bucket8h = Math.floor(nowMs / (8 * 3600_000));
    const direction = rate8h > 0 ? 'longs-pay' : 'shorts-pay';

    out.push({
      eventId: `funding-extreme:${s.symbol}:${s.exchange}:${direction}:${bucket8h}`,
      kind: 'funding-extreme',
      symbol: s.symbol,
      venue: s.exchange,
      value: rate8h,
      metadata: {
        rate8h,
        rawRate: s.rate,
        fundingInterval: s.fundingInterval,
        direction,
      },
      detectedAt: nowMs,
    });
  }

  return out;
}

/* ─── 2. OI spike ─────────────────────────────────────────────────── */

/**
 * Compares latest OI snapshots to ~1h ago and emits an event for any
 * major-OI symbol that moved by more than `oiSpikePct`%. The detector
 * is bucketed per-symbol — only the largest absolute % change per
 * symbol surfaces, preventing duplicate events for the same symbol's
 * OI swing across multiple venues.
 *
 * Caller provides:
 *   - `current`: latest aggregated OI per symbol (one row per symbol)
 *   - `oneHourAgo`: aggregated OI per symbol ~1h ago (matching shape)
 */
export function detectOISpikes(
  current: OIDataPoint[],
  oneHourAgo: OIDataPoint[],
  nowMs: number = Date.now(),
): AutoTweetEvent[] {
  const past = new Map(oneHourAgo.map(p => [p.symbol, p.oiUsd]));
  const out: AutoTweetEvent[] = [];

  for (const c of current) {
    if (c.oiUsd < THRESHOLDS.oiSpikeMinUsd) continue;
    const prev = past.get(c.symbol);
    if (prev == null || prev <= 0) continue;
    const pct = ((c.oiUsd - prev) / prev) * 100;
    if (!Number.isFinite(pct)) continue;
    if (Math.abs(pct) < THRESHOLDS.oiSpikePct) continue;

    const bucket1h = Math.floor(nowMs / 3600_000);
    const direction = pct > 0 ? 'build' : 'unwind';

    out.push({
      eventId: `oi-spike:${c.symbol}:${direction}:${bucket1h}`,
      kind: 'oi-spike',
      symbol: c.symbol,
      venue: null,
      value: pct,
      metadata: {
        pct,
        currentOiUsd: c.oiUsd,
        previousOiUsd: prev,
        direction,
      },
      detectedAt: nowMs,
    });
  }

  return out;
}

/* ─── 3. Liquidation cascade ─────────────────────────────────────── */

/**
 * Sums liquidations in a 5-minute rolling window per symbol; emits an
 * event when the total crosses `liqCascadeUsd`. Reports the long/short
 * split so the tweet can say "$15M liquidated · 89% long".
 *
 * Caller passes ALL recent liquidations (we filter to the window here).
 */
export function detectLiqCascades(
  recentLiquidations: LiquidationDataPoint[],
  nowMs: number = Date.now(),
): AutoTweetEvent[] {
  const windowStart = nowMs - 5 * 60_000;
  const inWindow = recentLiquidations.filter(l => l.ts >= windowStart);

  // Group by symbol
  const bySymbol = new Map<string, { total: number; long: number; short: number }>();
  for (const l of inWindow) {
    if (!Number.isFinite(l.valueUsd) || l.valueUsd <= 0) continue;
    const entry = bySymbol.get(l.symbol) ?? { total: 0, long: 0, short: 0 };
    entry.total += l.valueUsd;
    if (l.side === 'long') entry.long += l.valueUsd;
    else entry.short += l.valueUsd;
    bySymbol.set(l.symbol, entry);
  }

  const out: AutoTweetEvent[] = [];
  const bucket5min = Math.floor(nowMs / (5 * 60_000));

  for (const [symbol, stats] of Array.from(bySymbol.entries())) {
    if (stats.total < THRESHOLDS.liqCascadeUsd) continue;
    const longShare = stats.long / stats.total;
    const dominantSide = longShare >= 0.6 ? 'long' : longShare <= 0.4 ? 'short' : 'mixed';

    out.push({
      eventId: `liq-cascade:${symbol}:${bucket5min}`,
      kind: 'liq-cascade',
      symbol,
      venue: null,
      value: stats.total,
      metadata: {
        totalUsd: stats.total,
        longUsd: stats.long,
        shortUsd: stats.short,
        longSharePct: longShare * 100,
        dominantSide,
      },
      detectedAt: nowMs,
    });
  }

  return out;
}
