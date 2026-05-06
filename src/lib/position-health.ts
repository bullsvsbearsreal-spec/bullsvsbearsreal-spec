/**
 * Position Health Score
 * =====================
 *
 * Single 0-100 number summarising how risky an open derivatives position is
 * RIGHT NOW. Designed to surface the "your BTC long is unhealthy because:
 * liq is 4% away + no SL set + funding -0.08%/8h" insight without forcing
 * the trader to inspect every column.
 *
 * Score breakdown (each component is independent, then combined):
 *
 *   1. Liquidation buffer       — how close mark is to liq (40% weight)
 *   2. Leverage                 — raw leverage tier (25% weight)
 *   3. Stop-loss hygiene        — SL set? distance reasonable? (15% weight)
 *   4. Funding cost trajectory  — paying or receiving? at what rate? (15% weight)
 *   5. Profitability check      — deeply underwater = lower score (5% weight)
 *
 * Each sub-score is normalised 0-100 (higher = healthier). The final score
 * is a weighted average, then clamped to [0, 100]. Returned alongside the
 * raw sub-scores so the UI can show a tooltip "what's dragging this down".
 *
 * Usage:
 *   const health = scorePositionHealth({
 *     side, size, entryPrice, markPrice, leverage,
 *     liquidationPrice, tpPrice, slPrice,
 *     unrealizedPnl, marginUsed, currentFunding,
 *   });
 *   // → { score: 42, label: 'risky', factors: { liqBuffer: 25, leverage: 60, ... } }
 *
 * Pure function. No DB / network. Easy to unit-test.
 */

export interface PositionHealthInput {
  side: 'long' | 'short';
  /** Mark price; if null we fall back to entry (degraded score). */
  markPrice: number | null;
  entryPrice: number;
  /** Effective leverage (e.g. 10x). null treated as 1x for scoring. */
  leverage: number | null;
  /** Liquidation price reported by the venue. null = unknown (penalty). */
  liquidationPrice: number | null;
  /** Take-profit trigger. null = unset (informational, no penalty). */
  tpPrice: number | null;
  /** Stop-loss trigger. null = unset (penalty for high-lev positions). */
  slPrice: number | null;
  /** Open PnL in USD. null treated as 0. */
  unrealizedPnl: number | null;
  /** Margin posted in USD. null treated as 0. */
  marginUsed: number | null;
  /** Current funding rate in percent per native interval (e.g. 0.01 = 0.01% per 8h). */
  currentFunding: number | null;
}

export interface PositionHealthResult {
  /** 0-100, higher = healthier. */
  score: number;
  /** Human label tied to the score band. */
  label: 'critical' | 'risky' | 'caution' | 'ok' | 'healthy';
  /** Per-factor sub-scores 0-100 so the UI can explain the verdict. */
  factors: {
    liqBuffer: number;
    leverage: number;
    stopLoss: number;
    funding: number;
    profitability: number;
  };
  /** Top 1-3 reasons the score is dragged down (empty if score >= 80). */
  reasons: string[];
}

/** Convert a 0-100 score into a 5-tier label. */
export function healthLabel(score: number): PositionHealthResult['label'] {
  if (score < 25) return 'critical';
  if (score < 45) return 'risky';
  if (score < 65) return 'caution';
  if (score < 85) return 'ok';
  return 'healthy';
}

/**
 * Score the liquidation buffer: how far is mark from the liquidation price,
 * expressed as a percentage of mark? Returns 0 (already at liq) → 100 (>20%
 * cushion). Penalises null liquidation price as 50 (unknown, partial credit).
 */
function scoreLiqBuffer(input: PositionHealthInput): number {
  const { markPrice, entryPrice, liquidationPrice, side } = input;
  if (liquidationPrice == null) return 50; // unknown — partial credit
  const ref = markPrice && markPrice > 0 ? markPrice : entryPrice;
  if (!ref || ref <= 0) return 50;

  // Distance to liq as a fraction of mark, signed-correct per side. A long
  // is hurt when mark falls below liq; a short when mark rises above liq.
  const distance = side === 'long'
    ? (ref - liquidationPrice) / ref
    : (liquidationPrice - ref) / ref;

  if (distance <= 0) return 0;          // already past liq (shouldn't happen)
  if (distance >= 0.20) return 100;     // 20%+ cushion is plenty
  // 0% → 0, 5% → 50, 10% → 75, 20% → 100. Square-root-ish curve so the
  // first percent of cushion matters most.
  return Math.round(Math.sqrt(distance / 0.20) * 100);
}

/** Penalise raw leverage. 1x→100, 5x→80, 10x→60, 25x→30, 50x+→0. */
function scoreLeverage(input: PositionHealthInput): number {
  const lev = input.leverage ?? 1;
  if (!Number.isFinite(lev) || lev <= 1) return 100;
  if (lev >= 50) return 0;
  // Linear-ish piecewise. Inflection at 10x (the "memestock" threshold).
  if (lev <= 10) return Math.round(100 - (lev - 1) * (40 / 9));   // 1→100, 10→60
  return Math.round(60 - (lev - 10) * (60 / 40));                  // 10→60, 50→0
}

/**
 * Stop-loss hygiene. The penalty for "no SL" scales with leverage: a 1x
 * spot-like position doesn't really need one, but a 25x perp without an SL
 * is one bad headline away from a margin call.
 */
function scoreStopLoss(input: PositionHealthInput): number {
  const { slPrice, leverage, markPrice, entryPrice, side } = input;
  const lev = leverage ?? 1;
  if (slPrice == null || slPrice <= 0) {
    // No SL set. Penalty grows with leverage.
    if (lev <= 1) return 80;       // unleveraged — barely matters
    if (lev <= 3) return 60;
    if (lev <= 10) return 30;
    return 10;                     // 10x+ with no SL is reckless
  }
  // SL is set — bonus, but check it's actually protective. For a long, SL
  // must be below mark; for a short, above mark. A backwards SL won't fire.
  const ref = markPrice && markPrice > 0 ? markPrice : entryPrice;
  if (ref > 0) {
    const valid = side === 'long' ? slPrice < ref : slPrice > ref;
    if (!valid) return 40;         // backwards SL — cosmetic only
  }
  return 100;
}

/**
 * Funding cost trajectory. Positive funding = longs pay shorts. So a long
 * with positive current funding is bleeding; a short with negative funding
 * is bleeding. Magnitude matters: 0.05%/8h ≈ 55%/year at constant rate.
 *
 * We grade the SIGNED rate the user is paying:
 *   ≤ 0% (collecting):   100
 *   ~ 0.01%/8h paying:    85
 *   ~ 0.03%/8h paying:    65
 *   ~ 0.10%/8h paying:    25
 *   ≥ 0.20%/8h paying:    0
 */
function scoreFunding(input: PositionHealthInput): number {
  const { currentFunding, side } = input;
  if (currentFunding == null) return 70; // unknown — slight penalty
  // What the user is paying (positive = paying, negative = collecting).
  const paying = side === 'long' ? currentFunding : -currentFunding;
  if (paying <= 0) return 100;
  if (paying >= 0.20) return 0;
  // Smooth piecewise: 0%→100, 0.05%→70, 0.10%→40, 0.20%→0.
  return Math.round(Math.max(0, 100 - (paying / 0.20) * 100));
}

/**
 * Profitability check — small contributor, just to differentiate "winning
 * trade nearing TP" from "losing trade approaching liq" when other factors
 * are equal. ROI = pnl / margin.
 *
 *   ROI ≤ -100%   (margin gone):    0
 *   ROI = -50%:                    25
 *   ROI = 0:                       70
 *   ROI ≥ +50%:                   100
 */
function scoreProfitability(input: PositionHealthInput): number {
  const { unrealizedPnl, marginUsed } = input;
  if (!marginUsed || marginUsed <= 0) return 70;
  const roi = (unrealizedPnl ?? 0) / marginUsed;
  if (roi <= -1) return 0;
  if (roi >= 0.5) return 100;
  // Linear from -100% → 0, 0 → 70, +50% → 100.
  if (roi < 0) return Math.round(70 + roi * 70);    // roi=-1 → 0, roi=0 → 70
  return Math.round(70 + roi * 60);                  // roi=0 → 70, roi=0.5 → 100
}

const WEIGHTS = {
  liqBuffer: 0.40,
  leverage: 0.25,
  stopLoss: 0.15,
  funding: 0.15,
  profitability: 0.05,
} as const;

/**
 * Compute the full health score + per-factor breakdown.
 * Pure — no side effects, no async.
 */
export function scorePositionHealth(input: PositionHealthInput): PositionHealthResult {
  const factors = {
    liqBuffer: scoreLiqBuffer(input),
    leverage: scoreLeverage(input),
    stopLoss: scoreStopLoss(input),
    funding: scoreFunding(input),
    profitability: scoreProfitability(input),
  };

  const score = Math.round(
    factors.liqBuffer * WEIGHTS.liqBuffer +
    factors.leverage * WEIGHTS.leverage +
    factors.stopLoss * WEIGHTS.stopLoss +
    factors.funding * WEIGHTS.funding +
    factors.profitability * WEIGHTS.profitability,
  );

  const reasons = explainHealth(factors, input);
  return { score: Math.max(0, Math.min(100, score)), label: healthLabel(score), factors, reasons };
}

/**
 * Pick the 1-3 most impactful negative factors and emit human-readable
 * one-liners. Suppresses anything where the sub-score is ≥ 70 since those
 * aren't really dragging the verdict.
 */
function explainHealth(
  factors: PositionHealthResult['factors'],
  input: PositionHealthInput,
): string[] {
  const concerns: Array<{ score: number; reason: string }> = [];

  if (factors.liqBuffer < 70) {
    if (input.liquidationPrice == null) {
      concerns.push({ score: factors.liqBuffer, reason: 'Liquidation price unknown' });
    } else {
      const ref = input.markPrice && input.markPrice > 0 ? input.markPrice : input.entryPrice;
      const dist = input.side === 'long'
        ? (ref - input.liquidationPrice) / ref
        : (input.liquidationPrice - ref) / ref;
      const pct = (dist * 100).toFixed(1);
      concerns.push({ score: factors.liqBuffer, reason: `Liq only ${pct}% away` });
    }
  }
  if (factors.leverage < 70) {
    concerns.push({ score: factors.leverage, reason: `${(input.leverage ?? 1).toFixed(0)}× leverage` });
  }
  if (factors.stopLoss < 70) {
    concerns.push({
      score: factors.stopLoss,
      reason: input.slPrice == null ? 'No stop-loss set' : 'Stop-loss is on wrong side',
    });
  }
  if (factors.funding < 70 && input.currentFunding != null) {
    const paying = input.side === 'long' ? input.currentFunding : -input.currentFunding;
    if (paying > 0) {
      concerns.push({
        score: factors.funding,
        reason: `Paying ${paying.toFixed(3)}% funding`,
      });
    }
  }
  if (factors.profitability < 50) {
    concerns.push({ score: factors.profitability, reason: 'Deep underwater' });
  }

  return concerns
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(c => c.reason);
}
