/**
 * Pure builder for <ChartSignalsStrip> — extracted into a .ts file
 * (no JSX) so the heuristic can be unit-tested cheaply without
 * dragging React into the test runtime.
 *
 * The component file maps `iconName` → a lucide-react icon and
 * applies tone styling. Everything else lives here.
 */

export type SignalTone = 'bullish' | 'bearish' | 'neutral' | 'caution';

export type SignalIconName =
  | 'flame'        // funding-extreme
  | 'trending-up'  // bullish momentum
  | 'trending-down' // bearish momentum
  | 'scale'        // funding flat / balance
  | 'eye'          // crowding / positioning
  | 'snowflake'    // quiet build (cold)
  | 'alert'        // caution / flush risk
  | 'gauge'        // RSI
  | 'activity';    // ATR / volatility

export interface Signal {
  key: string;
  label: string;
  tone: SignalTone;
  iconName: SignalIconName;
  detail?: string;
}

export interface ChartSignalsStripData {
  symbol: string;
  fundingRatePct?: number | null;           // 8h-normalised, in %
  openInterestChange24hPct?: number | null; // %
  change24hPct?: number | null;             // %
  longRatio?: number | null;                // 0-1
  shortRatio?: number | null;               // 0-1
  longShortRatio?: number | null;
  rsi?: number | null;                      // 0-100
  atrPct?: number | null;                   // ATR as % of last close
}

export function buildSignals(d: ChartSignalsStripData): Signal[] {
  const out: Signal[] = [];

  // 1. Funding regime
  if (d.fundingRatePct != null) {
    const abs = Math.abs(d.fundingRatePct);
    if (abs >= 0.05) {
      out.push({
        key: 'funding-extreme',
        label: d.fundingRatePct > 0 ? 'Funding overheated' : 'Funding deeply negative',
        tone: d.fundingRatePct > 0 ? 'caution' : 'bullish',
        iconName: 'flame',
        detail: `${d.fundingRatePct >= 0 ? '+' : ''}${d.fundingRatePct.toFixed(4)}%/8h`,
      });
    } else if (abs >= 0.01) {
      out.push({
        key: 'funding-mild',
        label: d.fundingRatePct > 0 ? 'Longs paying' : 'Shorts paying',
        tone: d.fundingRatePct > 0 ? 'bearish' : 'bullish',
        iconName: d.fundingRatePct > 0 ? 'trending-down' : 'trending-up',
        detail: `${d.fundingRatePct >= 0 ? '+' : ''}${d.fundingRatePct.toFixed(4)}%/8h`,
      });
    } else {
      out.push({
        key: 'funding-flat',
        label: 'Funding neutral',
        tone: 'neutral',
        iconName: 'scale',
        detail: `${d.fundingRatePct >= 0 ? '+' : ''}${d.fundingRatePct.toFixed(4)}%/8h`,
      });
    }
  }

  // 2. OI delta
  if (d.openInterestChange24hPct != null) {
    const abs = Math.abs(d.openInterestChange24hPct);
    if (abs >= 5) {
      out.push({
        key: 'oi-shift',
        label: d.openInterestChange24hPct > 0 ? 'OI building' : 'OI unwinding',
        tone: d.openInterestChange24hPct > 0 ? 'bullish' : 'caution',
        iconName: d.openInterestChange24hPct > 0 ? 'trending-up' : 'trending-down',
        detail: `${d.openInterestChange24hPct >= 0 ? '+' : ''}${d.openInterestChange24hPct.toFixed(1)}% 24h`,
      });
    }
  }

  // 3. Spot momentum
  if (d.change24hPct != null) {
    const abs = Math.abs(d.change24hPct);
    if (abs >= 5) {
      out.push({
        key: 'spot-momo',
        label: d.change24hPct > 0 ? 'Strong move up' : 'Strong move down',
        tone: d.change24hPct > 0 ? 'bullish' : 'bearish',
        iconName: d.change24hPct > 0 ? 'trending-up' : 'trending-down',
        detail: `${d.change24hPct >= 0 ? '+' : ''}${d.change24hPct.toFixed(2)}% 24h`,
      });
    }
  }

  // 4. Positioning skew (L/S extremes)
  if (d.longRatio != null && d.shortRatio != null) {
    const longPct = d.longRatio * 100;
    if (longPct >= 65) {
      out.push({
        key: 'ls-long-heavy',
        label: 'Crowded longs',
        tone: 'caution',
        iconName: 'eye',
        detail: `${longPct.toFixed(1)}% long`,
      });
    } else if (longPct <= 35) {
      out.push({
        key: 'ls-short-heavy',
        label: 'Crowded shorts',
        tone: 'caution',
        iconName: 'eye',
        detail: `${(d.shortRatio * 100).toFixed(1)}% short`,
      });
    }
  }

  // 5. Confluence — funding flat + OI building = quiet accumulation
  if (d.fundingRatePct != null && d.openInterestChange24hPct != null &&
      Math.abs(d.fundingRatePct) < 0.01 && d.openInterestChange24hPct > 2) {
    out.push({
      key: 'quiet-build',
      label: 'Quiet OI build',
      tone: 'bullish',
      iconName: 'snowflake',
      detail: 'flat funding · rising OI',
    });
  }

  // 6. Confluence — funding hot + OI down = positions unwinding
  if (d.fundingRatePct != null && d.openInterestChange24hPct != null &&
      d.fundingRatePct > 0.03 && d.openInterestChange24hPct < -2) {
    out.push({
      key: 'long-flush',
      label: 'Long flush risk',
      tone: 'caution',
      iconName: 'alert',
      detail: 'hot funding · OI dropping',
    });
  }

  // 7. RSI — real TA from Binance perp klines on the active timeframe
  if (d.rsi != null) {
    if (d.rsi >= 75) {
      out.push({ key: 'rsi-overbought', label: 'RSI overbought', tone: 'caution',
        iconName: 'gauge', detail: d.rsi.toFixed(1) });
    } else if (d.rsi <= 25) {
      out.push({ key: 'rsi-oversold', label: 'RSI oversold', tone: 'bullish',
        iconName: 'gauge', detail: d.rsi.toFixed(1) });
    }
  }

  // 8. Volatility regime — ATR as % of price; high ATR% = expanded range
  if (d.atrPct != null) {
    if (d.atrPct >= 3) {
      out.push({ key: 'vol-high', label: 'High volatility', tone: 'caution',
        iconName: 'activity', detail: `ATR ${d.atrPct.toFixed(2)}%` });
    } else if (d.atrPct <= 0.5) {
      out.push({ key: 'vol-compressed', label: 'Volatility compressed', tone: 'neutral',
        iconName: 'activity', detail: `ATR ${d.atrPct.toFixed(2)}%` });
    }
  }

  return out;
}
