/**
 * Pure trade-sizing math for the /position-size page. Extracted so
 * the formulas can be unit-tested — the page itself has no tests,
 * and the math has subtle edge cases (sub-1x leverage no-liq, side
 * direction flip, division by zero on zero stop distance) that
 * silently produce nonsense outputs if regressed.
 *
 * Real money flows through these numbers — a user reading
 * "leverageNeeded: 4.2x" sizes a position. We cannot guess wrong.
 */
export type Side = 'long' | 'short';

/** Simplified maintenance-margin rate for major perps. Real venues
 *  have tiered MMR schedules; this matches within ~10% for sub-50x
 *  leverage. Anything closer than ~3% to the wall under high lev is
 *  outside the validity envelope of this approximation. */
export const MAINT_MARGIN = 0.005;

export interface SizingInputs {
  side: Side;
  account: number;   // USD
  riskPct: number;   // 0-100
  entry: number;     // price
  stop: number;      // price
  target?: number;   // price, optional
}

export interface SizingResult {
  riskUsd: number;
  stopDistPct: number;    // %  (e.g. 2 means 2% away)
  stopDistAbs: number;    // absolute price gap
  directionValid: boolean;
  notional: number;       // USD position notional
  positionUnits: number;  // base units (e.g. BTC quantity)
  leverageNeeded: number; // x
  rrRatio: number;        // target/stop ratio, 0 if no target
  targetMove: number;     // % move to target
  targetPnl: number;      // USD if target hit
  feeBreakEvenPct: number; // % move just to cover fees (0.05% taker × 2)
}

/** Compute trade sizing from risk + stop. Returns null when inputs
 *  are invalid (non-positive account/risk/entry/stop). */
export function computeSizing(input: SizingInputs): SizingResult | null {
  const { side, account, riskPct, entry, stop, target = 0 } = input;
  if (!(account > 0) || !(riskPct > 0) || !(entry > 0) || !(stop > 0)) {
    return null;
  }

  const riskUsd = (account * riskPct) / 100;
  const stopDistPct = Math.abs(entry - stop) / entry;
  const stopDistAbs = Math.abs(entry - stop);

  // Direction sanity: stop must be BELOW entry for a long and
  // ABOVE for a short. The UI still surfaces a result either way
  // so the user can see the math, but flags the inversion.
  const directionValid = side === 'long' ? stop < entry : stop > entry;

  // Notional sizing: risk / stop-distance = position size in USD
  // — i.e. if my stop is 2% away, 1% account risk → 50% notional.
  const notional = stopDistPct > 0 ? riskUsd / stopDistPct : 0;
  const positionUnits = entry > 0 ? notional / entry : 0;
  const leverageNeeded = account > 0 ? notional / account : 0;

  let rrRatio = 0;
  let targetMove = 0;
  let targetPnl = 0;
  if (target > 0) {
    targetMove = Math.abs(target - entry) / entry;
    targetPnl = notional * targetMove;
    rrRatio = stopDistPct > 0 ? targetMove / stopDistPct : 0;
  }

  // Round-trip taker fee assumption — 0.05% per side, both sides.
  // Anything that moves less than this just covers your costs.
  const feeBreakEvenPct = 0.1;

  return {
    riskUsd,
    stopDistPct: stopDistPct * 100,
    stopDistAbs,
    directionValid,
    notional,
    positionUnits,
    leverageNeeded,
    rrRatio,
    targetMove: targetMove * 100,
    targetPnl,
    feeBreakEvenPct,
  };
}

export interface LiqPreviewInputs {
  side: Side;
  entry: number;
  stop: number;
  account: number;
  riskPct: number;
  /** Explicit leverage override. Use 0 / NaN / undefined to fall back
   *  to the implicit leverage from the sizing calc (notional/account). */
  userLeverage?: number;
}

export type LiqPreview =
  | null
  | {
      noLiqRisk: true;
      leverageUsed: number;
      liq: null;
      distPct: null;
      stopToLiqPct: null;
    }
  | {
      noLiqRisk: false;
      leverageUsed: number;
      liq: number;
      distPct: number;     // % gap entry→liq
      stopToLiqPct: number; // % stop→liq, NEGATIVE means liq fires FIRST (bad)
    };

/** Liquidation preview using a simplified isolated-margin formula
 *  common across major CEXs. Returns null when inputs can't produce
 *  a liq price at all (zero leverage, zero entry).
 *
 *  Sub-1x leverage is a special case: the collateral fully covers
 *  the position so there is mathematically no liquidation. The UI
 *  needs to render "No liq risk" rather than a nonsense
 *  negative/above-price value. Returned as `noLiqRisk: true`. */
export function computeLiqPreview(input: LiqPreviewInputs): LiqPreview {
  const { side, entry, stop, account, riskPct, userLeverage } = input;

  // Duplicates the cheap part of computeSizing's leverage calc so
  // this function stands alone. Keeps testing simple.
  const stopDistPct = entry > 0 ? Math.abs(entry - stop) / entry : 0;
  const computedLev = stopDistPct > 0 && account > 0
    ? ((account * riskPct) / 100 / stopDistPct) / account
    : 0;

  const lev = Number.isFinite(userLeverage) && (userLeverage as number) > 0
    ? (userLeverage as number)
    : computedLev;

  if (!lev || lev <= 0 || entry <= 0) return null;

  if (lev < 1) {
    return {
      noLiqRisk: true,
      leverageUsed: lev,
      liq: null,
      distPct: null,
      stopToLiqPct: null,
    };
  }

  const liq = side === 'long'
    ? entry * (1 - 1 / lev + MAINT_MARGIN)
    : entry * (1 + 1 / lev - MAINT_MARGIN);

  const distPct = Math.abs(liq - entry) / entry;

  // Distance stop → liq, in % of entry. Long: stop minus liq
  // (stop should be ABOVE liq, so positive = safe).
  // Short: liq minus stop  (stop should be BELOW liq).
  const stopToLiqPct = side === 'long'
    ? (stop - liq) / entry
    : (liq - stop) / entry;

  return {
    noLiqRisk: false,
    leverageUsed: lev,
    liq,
    distPct: distPct * 100,
    stopToLiqPct: stopToLiqPct * 100,
  };
}

export interface KellyInputs {
  /** Win rate, 0-100 (the UI input is in percent). */
  winRate: number;
  /** Average winning trade as R-multiple. */
  avgWin: number;
  /** Average losing trade as R-multiple. */
  avgLoss: number;
}

export interface KellyResult {
  kellyPct: number; // recommended % of bankroll per trade (full Kelly)
  halfKelly: number; // half-Kelly — usually safer
  ev: number;       // expected R per trade
}

/** Kelly Criterion sizing. Returns null on degenerate inputs
 *  (NaN, ≤0 for win rate / wins / losses, win rate ≥100). */
export function computeKelly(input: KellyInputs): KellyResult | null {
  const { winRate, avgWin, avgLoss } = input;
  if (!Number.isFinite(winRate) || !Number.isFinite(avgWin) || !Number.isFinite(avgLoss)) {
    return null;
  }
  if (winRate <= 0 || winRate >= 100 || avgWin <= 0 || avgLoss <= 0) {
    return null;
  }
  const w = winRate / 100;
  const b = avgWin / avgLoss;
  // Kelly % = W - (1-W)/b
  const kellyPct = w - (1 - w) / b;
  const halfKelly = kellyPct / 2;
  const ev = w * avgWin - (1 - w) * avgLoss;
  return {
    kellyPct: kellyPct * 100,
    halfKelly: halfKelly * 100,
    ev,
  };
}

export type RiskTier = 'low' | 'moderate' | 'high' | 'extreme';

/** Map leverage → risk tier label. Thresholds match the UI colors:
 *    >20x  extreme (red)
 *    >10x  high    (orange)
 *    >3x   moderate (yellow)
 *    else  low     (green) */
export function riskTierFor(leverage: number): RiskTier {
  if (!Number.isFinite(leverage) || leverage <= 0) return 'low';
  if (leverage > 20) return 'extreme';
  if (leverage > 10) return 'high';
  if (leverage > 3) return 'moderate';
  return 'low';
}
