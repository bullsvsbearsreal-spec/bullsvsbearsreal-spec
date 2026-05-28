/**
 * Pure setup-quality scoring for /api/breakouts. Extracted so the
 * composite formula can be unit-tested — without that, a tweak to
 * any one of the four sub-scores silently re-orders the entire
 * /breakouts page and users see "10/100 ATH proximity" instead of
 * "25/100". The Pro $29 tier is partly justified by this surface
 * being usable, so a regression that misranks setups is real.
 *
 * Score components (each clamped):
 *   1. Momentum stack   — up to ±40 points (24h + 7d + 30d trend)
 *   2. Range position   — up to +25 / -10 (where in 24h range price sits)
 *   3. ATH proximity    — up to +25 / 0   (closer to ATH = stronger structure)
 *   4. Volume health    — up to +10 / -5  (vol / market-cap ratio proxy)
 *
 * Final score is centred at 50 + clamped to [0, 100].
 */

export interface QualityInputs {
  /** 24h price change in % (e.g. 3.5 means +3.5%) */
  c24: number;
  /** 7d  price change in % */
  c7: number;
  /** 30d price change in % */
  c30: number;
  /** Current price (USD). Used with high24/low24 for range position. */
  price: number;
  /** 24h high */
  high24: number;
  /** 24h low */
  low24: number;
  /** % from ATH. Negative = below ATH (e.g. -3 = 3% below ATH). */
  athPct: number;
  /** Market cap (USD). 0 / null = unknown → vol ratio falls back to 0. */
  marketCap?: number | null;
  /** 24h volume (USD). 0 / null = unknown. */
  volume24h?: number | null;
}

export interface QualityBreakdown {
  /** Final score, clamped to [0, 100]. */
  score: number;
  /** Raw centred score (q + 50, pre-clamp + pre-round). For debugging. */
  raw: number;
  /** Per-component breakdown for tooltips / debugging. */
  components: {
    momStack: number;
    rangePoints: number;
    athPoints: number;
    volPoints: number;
  };
}

/** Compute the breakout-setup quality score (0–100). The formula
 *  is identical to the one inlined in /api/breakouts/route.ts —
 *  keep them in sync (or, better, delete the inline copy after this
 *  module is wired). */
export function computeQualityScore(input: QualityInputs): QualityBreakdown {
  const { c24, c7, c30, price, high24, low24, athPct } = input;
  const marketCap = input.marketCap ?? 0;
  const volume24h = input.volume24h ?? 0;

  // 1. Momentum stack — up to ±40. Weight scales with timeframe: a
  //    +30d is stronger evidence than a +24h. The negative branches
  //    fire on big drawdowns (-5% 24h, -10% 7d, -20% 30d).
  const momStack = (c24 > 0 ? 8 : c24 < -5 ? -8 : 0)
                 + (c7  > 0 ? 12 : c7  < -10 ? -12 : 0)
                 + (c30 > 0 ? 20 : c30 < -20 ? -20 : 0);
  const momStackClamped = Math.max(-40, Math.min(40, momStack));

  // 2. Range position — where is price within today's high/low?
  //    0 = at low, 1 = at high. Upper third (>=0.7) = breakout-y.
  //    Lower third (<0.3) = below mid-day mean → -10 penalty.
  const range = high24 - low24;
  const rangePos = (price > 0 && range > 0) ? (price - low24) / range : 0.5;
  const rangePoints = rangePos >= 0.7 ? 25
                   : rangePos >= 0.5 ? 12
                   : rangePos >= 0.3 ? 0
                   : -10;

  // 3. ATH proximity — closer to ATH = stronger structure. Caps
  //    at 25 points within 2% of ATH; tapers to 0 by -30%.
  const athPoints = athPct >= -2 ? 25
                 : athPct >= -10 ? 18
                 : athPct >= -20 ? 10
                 : athPct >= -30 ? 4
                 : 0;

  // 4. Volume health — vol/market-cap ratio is a rough liquidity-
  //    of-interest proxy. Pure altcoin breakouts often have
  //    vol/mc > 0.05 (high turnover); dormant coins are <0.01.
  const volMcRatio = marketCap > 0 ? volume24h / marketCap : 0;
  const volPoints = volMcRatio >= 0.1 ? 10
                 : volMcRatio >= 0.05 ? 5
                 : volMcRatio >= 0.01 ? 0
                 : -5;

  const q = momStackClamped + rangePoints + athPoints + volPoints;
  const raw = q + 50;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    raw,
    components: {
      momStack: momStackClamped,
      rangePoints,
      athPoints,
      volPoints,
    },
  };
}
