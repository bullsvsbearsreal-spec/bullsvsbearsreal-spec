// ─── Trader Slang Tooltips ────────────────────────────────────────────────────
// Context-aware quips for hover tooltips. Makes data more human and addictive.

/** Trader slang for funding rate values */
export function getFundingSlang(rate: number): string {
  // rate is already in percentage form (e.g. 0.01 = 0.01%)
  if (rate > 0.1) return 'Longs absolutely loaded — paying massive premium';
  if (rate > 0.05) return 'Degens pumping hard — expensive to be long';
  if (rate > 0.01) return 'Longs paying up — moderately bullish sentiment';
  if (rate > 0) return 'Slight long bias — normal market conditions';
  if (rate === 0) return 'Perfectly neutral — balanced market';
  if (rate > -0.01) return 'Slight short bias — bears nibbling';
  if (rate > -0.05) return 'Shorts paying up — bears getting aggressive';
  if (rate > -0.1) return 'Short squeeze territory — expensive to be short';
  return 'Absolute carnage for shorts — mega squeeze incoming';
}

/** Trader slang for spread size */
export function getSpreadSlang(pct: number): string {
  if (pct > 1) return 'Massive arb — free money if you can execute fast enough';
  if (pct > 0.5) return 'Fat spread — juicy arb opportunity';
  if (pct > 0.1) return 'Decent spread — worth watching for entry';
  if (pct > 0.05) return 'Thin spread — might cover fees on size';
  if (pct > 0.01) return 'Tight spread — efficient market';
  return 'Razor thin — no arb here, move along';
}

/** Trader slang for price deviation from median */
export function getDeviationSlang(devPct: number): string {
  const abs = Math.abs(devPct);
  if (abs > 0.5) return devPct > 0 ? 'Massive premium — this exchange is way ahead' : 'Deep discount — lagging hard';
  if (abs > 0.1) return devPct > 0 ? 'Premium — buyers aggressive here' : 'Discount — sellers in control';
  if (abs > 0.03) return devPct > 0 ? 'Slight premium' : 'Slight discount';
  return 'In line with market consensus';
}

/** Trader slang for OI values */
export function getOISlang(oiUsd: number): string {
  if (oiUsd > 1e10) return 'Whale territory — massive institutional positioning';
  if (oiUsd > 1e9) return 'Heavy positioning — billions at stake';
  if (oiUsd > 100e6) return 'Solid OI — liquid market';
  if (oiUsd > 10e6) return 'Moderate OI — decent liquidity';
  return 'Low OI — thin liquidity, watch for squeezes';
}
