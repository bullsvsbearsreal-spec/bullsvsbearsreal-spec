/**
 * Hub bot v2 — trade-idea signal scorer.
 *
 * Deterministic, multi-signal scoring 0-100. Same inputs always produce
 * the same score (no LLM randomness in the scoring layer — the LLM only
 * comes in to render the idea after the score + signal stack are fixed).
 *
 * Scoring contracts (locked by tests in __tests__/idea-scorer.test.ts):
 *
 *   Signal                                  Max wt   Trigger
 *   ───────────────────────────────────────────────────────────────────
 *   Funding extreme/flip                       30   |rate| ≥ 98th pctile (30d), or sign-flip in last 4h
 *   Whale positioning (HL/gTrade)              25   ≥ 2 whales added (or cut) ≥ $20M in last 4h
 *   OI delta + liq cluster proximity           20   OI Δ4h ≥ ±8% AND cluster within 3% of price
 *   Cross-venue basis blowout                  15   ≥ 1 venue's funding differs ≥ 0.02% from cohort
 *   Long/short ratio extreme                   10   L/S ratio at 95th pctile (contrarian)
 *
 * Star labels:
 *   85-100  ★★★★  proactive push eligible
 *   70-84   ★★★   proactive push eligible
 *   55-69   ★★    /ideas command only
 *   < 55    hidden
 *
 * Each signal's "fire" is graded — partial scores are allowed, so a
 * funding rate at the 90th percentile contributes proportionally less
 * than one at the 99th. This keeps the score smooth instead of a stair
 * function that flips on/off at arbitrary cutoffs.
 */

export type SetupType = 'funding_arb' | 'directional' | 'liq_hunt' | 'squeeze';
export type Side = 'long' | 'short';

export interface SignalInputs {
  /**
   * Current funding rate as a percent per native interval (e.g. 0.01 = 0.01%
   * per 8h on Binance). Sign carries direction: positive = longs pay.
   */
  fundingPct: number;
  /**
   * Percentile rank of |fundingPct| over the last 30 days, 0-100. 98+ means
   * we're in the top 2% of historical extremity.
   */
  fundingPctileAbs: number;
  /**
   * `true` if the sign of fundingPct flipped within the last 4 hours
   * (vs the rate at t-4h).
   */
  fundingSignFlipped4h: boolean;

  /**
   * Net whale flow USD over the last 4h. Positive = whales added longs,
   * negative = added shorts. Pulled from Wallet Watch + HL/gTrade scrapers.
   */
  whaleNetUsd4h: number;
  /** Distinct whale wallet count contributing to whaleNetUsd4h. */
  whaleCount4h: number;

  /** Open-interest percent change over the last 4 hours. */
  oiDelta4hPct: number;
  /**
   * Distance from current price to the nearest large liquidation cluster
   * on the SAME side, as a percent. 0-100. Use 999 if no cluster within
   * 10%.
   */
  liqClusterDistPct: number;

  /**
   * Largest cross-venue funding deviation from the cohort median, as a
   * percent. e.g. 0.025 means one venue's rate is 0.025% above the median.
   */
  basisSpreadMaxPct: number;

  /**
   * Long/short ratio (Binance / OKX / Bybit aggregate). 1.0 = balanced.
   * > 1 means more longs than shorts.
   */
  longShortRatio: number;
  /** Percentile rank of |lnRatio| over the last 30d, 0-100. */
  longShortPctileAbs: number;
}

export interface SignalContribution {
  /** Human-readable signal name, for the signal stack rendered to the user. */
  label: string;
  /** Internal slug for analytics. */
  slug: string;
  /** Contribution to total score (0 to max-weight). */
  points: number;
  /** One-line evidence string for the rendered idea. */
  detail: string;
}

export interface ScoredIdea {
  symbol: string;
  side: Side;
  setupType: SetupType;
  score: number;            // 0-100
  stars: 0 | 2 | 3 | 4;     // 0 = hidden
  signals: SignalContribution[];
  invalidation: number | null;
  horizonH: number;
}

/**
 * Per-signal maximum contribution. Tuned from the design doc; tests in
 * idea-scorer.test.ts pin these exact values so a future change has to
 * update both the table and the tests at the same time.
 */
export const SIGNAL_WEIGHTS = {
  funding: 30,
  whales: 25,
  oiCluster: 20,
  basis: 15,
  longShort: 10,
} as const;

/**
 * Score one (symbol, side) tuple from a snapshot of its signals. Returns
 * the full breakdown including which signals fired and the rendered
 * details — the LLM gets fed this directly when synthesizing the trade
 * idea, so it doesn't have to make up reasoning.
 */
export function scoreIdea(
  symbol: string,
  setupType: SetupType,
  side: Side,
  inputs: SignalInputs,
  opts: { currentPrice?: number; horizonH?: number } = {},
): ScoredIdea {
  const signals: SignalContribution[] = [];

  // ── Funding extreme/flip (0-30) ─────────────────────────────────
  // Two ways to score: extremity (percentile) and recent flip. We take
  // the max of the two so a recently-flipped non-extreme rate doesn't
  // get double-counted, and a deeply-extreme rate scores even without
  // a flip.
  const fundingDirOk = (side === 'long' && inputs.fundingPct < 0)
    || (side === 'short' && inputs.fundingPct > 0);
  let fundingPts = 0;
  let fundingDetail = '';
  if (fundingDirOk && inputs.fundingPctileAbs >= 85) {
    // Linear 85th → 0, 100th → 30
    const pctileBonus = ((inputs.fundingPctileAbs - 85) / 15) * SIGNAL_WEIGHTS.funding;
    fundingPts = Math.max(fundingPts, pctileBonus);
    fundingDetail = `Funding ${inputs.fundingPct >= 0 ? '+' : ''}${inputs.fundingPct.toFixed(3)}% (${inputs.fundingPctileAbs.toFixed(0)}th pctile)`;
  }
  if (fundingDirOk && inputs.fundingSignFlipped4h) {
    fundingPts = Math.max(fundingPts, SIGNAL_WEIGHTS.funding * 0.7);
    if (!fundingDetail) {
      fundingDetail = `Funding flipped to ${inputs.fundingPct >= 0 ? '+' : ''}${inputs.fundingPct.toFixed(3)}% in last 4h`;
    }
  }
  if (fundingPts > 0) {
    signals.push({
      label: 'Funding',
      slug: 'funding',
      points: round1(fundingPts),
      detail: fundingDetail,
    });
  }

  // ── Whale positioning (0-25) ─────────────────────────────────────
  // Direction must align: long-side ideas reward net inflow, short-side
  // ideas reward net outflow (cutting longs or adding shorts).
  const whaleDirOk = (side === 'long' && inputs.whaleNetUsd4h > 0)
    || (side === 'short' && inputs.whaleNetUsd4h < 0);
  const whaleAbs = Math.abs(inputs.whaleNetUsd4h);
  let whalePts = 0;
  if (whaleDirOk && inputs.whaleCount4h >= 2 && whaleAbs >= 20_000_000) {
    // Linear at $20M → 0, saturates at $100M+ → max
    const scale = Math.min(1, (whaleAbs - 20_000_000) / (100_000_000 - 20_000_000));
    // Reward count modestly — 2 whales = 70% of max, 5+ = 100%
    const countScale = Math.min(1, 0.6 + 0.1 * inputs.whaleCount4h);
    whalePts = SIGNAL_WEIGHTS.whales * 0.6 + (SIGNAL_WEIGHTS.whales * 0.4) * scale * countScale;
    const sideText = side === 'long' ? 'added' : 'cut/shorted';
    signals.push({
      label: 'Whales',
      slug: 'whales',
      points: round1(whalePts),
      detail: `${inputs.whaleCount4h} whales ${sideText} ${formatMoney(whaleAbs)} / 4h`,
    });
  }

  // ── OI delta + liq cluster proximity (0-20) ─────────────────────
  // Both conditions must hit for ANY points — OI alone isn't predictive,
  // cluster alone is just geography. Together they're cascade fuel.
  const oiOk = Math.abs(inputs.oiDelta4hPct) >= 8;
  const clusterOk = inputs.liqClusterDistPct <= 3;
  let oiClusterPts = 0;
  if (oiOk && clusterOk) {
    const oiScale = Math.min(1, (Math.abs(inputs.oiDelta4hPct) - 8) / 17); // 8% → 0, 25% → 1
    const clusterScale = Math.max(0, 1 - inputs.liqClusterDistPct / 3); // 0% → 1, 3% → 0
    oiClusterPts = SIGNAL_WEIGHTS.oiCluster * (0.5 + 0.5 * oiScale * clusterScale);
    signals.push({
      label: 'OI + Cluster',
      slug: 'oi_cluster',
      points: round1(oiClusterPts),
      detail: `OI ${inputs.oiDelta4hPct >= 0 ? '+' : ''}${inputs.oiDelta4hPct.toFixed(1)}% / 4h, cluster ${inputs.liqClusterDistPct.toFixed(1)}% away`,
    });
  }

  // ── Cross-venue basis blowout (0-15) ────────────────────────────
  // 0.02% → triggers, 0.05% → saturates max.
  let basisPts = 0;
  if (inputs.basisSpreadMaxPct >= 0.02) {
    const scale = Math.min(1, (inputs.basisSpreadMaxPct - 0.02) / 0.03);
    basisPts = SIGNAL_WEIGHTS.basis * (0.5 + 0.5 * scale);
    signals.push({
      label: 'Basis',
      slug: 'basis',
      points: round1(basisPts),
      detail: `Cross-venue funding spread ${inputs.basisSpreadMaxPct.toFixed(3)}%`,
    });
  }

  // ── Long/short ratio extreme (0-10) ──────────────────────────────
  // Contrarian: extreme long positioning rewards SHORT ideas, vice versa.
  const lsContrarianOk = (side === 'short' && inputs.longShortRatio > 1)
    || (side === 'long' && inputs.longShortRatio < 1);
  let lsPts = 0;
  if (lsContrarianOk && inputs.longShortPctileAbs >= 90) {
    lsPts = ((inputs.longShortPctileAbs - 90) / 10) * SIGNAL_WEIGHTS.longShort;
    signals.push({
      label: 'L/S',
      slug: 'long_short',
      points: round1(lsPts),
      detail: `L/S ${inputs.longShortRatio.toFixed(2)} (${inputs.longShortPctileAbs.toFixed(0)}th pctile)`,
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(
    fundingPts + whalePts + oiClusterPts + basisPts + lsPts,
  )));

  const stars = starsForScore(score);

  // Invalidation: 1× the typical 1h ATR away from current price on the
  // opposite side. For now, we use a simple % invalidation based on the
  // liq-cluster distance — if the user's side fails, they're in the
  // cascade. PR2 will swap to a proper ATR pull.
  const invalidation = opts.currentPrice && inputs.liqClusterDistPct < 999
    ? opts.currentPrice * (side === 'long'
      ? 1 - Math.max(0.015, inputs.liqClusterDistPct / 100 / 2)
      : 1 + Math.max(0.015, inputs.liqClusterDistPct / 100 / 2))
    : null;

  return {
    symbol,
    side,
    setupType,
    score,
    stars,
    signals,
    invalidation: invalidation != null ? Math.round(invalidation * 100) / 100 : null,
    horizonH: opts.horizonH ?? defaultHorizonForSetup(setupType),
  };
}

/** Map raw score to star label (0 = hidden). */
export function starsForScore(score: number): 0 | 2 | 3 | 4 {
  if (score >= 85) return 4;
  if (score >= 70) return 3;
  if (score >= 55) return 2;
  return 0;
}

/** Whether this idea should be surfaced via /ideas (≥ ★★) vs hidden. */
export function isSurfaceable(score: number): boolean {
  return starsForScore(score) >= 2;
}

/** Whether this idea is eligible for proactive push (≥ ★★★ = 75+). */
export function isPushable(score: number): boolean {
  return score >= 75;
}

/** Default horizon hours per setup type. */
export function defaultHorizonForSetup(setup: SetupType): number {
  switch (setup) {
    case 'funding_arb': return 8;    // one funding cycle
    case 'liq_hunt': return 4;
    case 'squeeze': return 24;
    case 'directional': return 72;   // 3-day swing
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatMoney(usd: number): string {
  const abs = Math.abs(usd);
  if (abs >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(usd / 1_000).toFixed(0)}k`;
  return `$${usd.toFixed(0)}`;
}
