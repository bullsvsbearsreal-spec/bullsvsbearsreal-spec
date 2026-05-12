/**
 * Auto-tweet event system — types shared across detectors, templates,
 * the runner, and the Twitter client.
 *
 * Each detector is a pure function (snapshot in → AutoTweetEvent[] out)
 * so unit tests can lock down thresholds without DB/network. The runner
 * is the only piece that touches DB + Twitter.
 */

export type AutoTweetEventKind =
  | 'funding-extreme'  // funding rate crossed ±0.1%/8h on a major venue
  | 'oi-spike'         // OI moved >5% in 1h on a top symbol
  | 'liq-cascade'      // >$10M liquidated in 5 min on a single symbol
  | 'whale-fill';      // single HL fill >$5M (future, not in v1)

export interface AutoTweetEvent {
  /** Stable dedup key — same event seen twice gets the same id. The DB
   *  has a UNIQUE constraint so duplicate inserts fail silently. */
  eventId: string;
  kind: AutoTweetEventKind;
  /** Primary symbol the event is about (e.g. "BTC"). */
  symbol: string;
  /** Venue when the event is per-venue (funding-extreme), null otherwise. */
  venue: string | null;
  /** Numeric value at the heart of the event (rate, OI %, USD, etc.). */
  value: number;
  /** Free-form metadata stored as JSONB in the DB. Useful for re-rendering
   *  the tweet later or debugging detection logic. */
  metadata: Record<string, unknown>;
  /** Detection timestamp in ms (when the runner saw it, not when it
   *  happened upstream). Bucketed timestamps go into eventId; this is
   *  for sort ordering. */
  detectedAt: number;
}

/** Detector input — minimal shape so detectors are easy to test. */
export interface FundingSnapshot {
  symbol: string;
  exchange: string;
  /** Native-interval funding rate as a fraction (0.001 = 0.1%). */
  rate: number;
  /** Funding cadence ('1h' / '4h' / '8h' / null). */
  fundingInterval: string | null;
  /** ms-epoch when the snapshot was captured upstream. */
  ts: number;
}

export interface OIDataPoint {
  symbol: string;
  oiUsd: number;
  ts: number;
}

export interface LiquidationDataPoint {
  symbol: string;
  side: 'long' | 'short';
  valueUsd: number;
  ts: number;
}
