'use client';

/**
 * Chart signals strip — compact horizontal row of colored "chip"
 * indicators that surface the strongest 4-6 heuristic signals for
 * the current symbol. Sits between the chart and the per-venue
 * funding strip, mirroring the mockup's signal-callout row.
 *
 * Pure presentational — fed by data already in the chart page's
 * derived state. Hides itself when there's no usable signal.
 */

import { TrendingUp, TrendingDown, Flame, Snowflake, Scale, Eye, AlertTriangle, Activity, Gauge } from 'lucide-react';

export interface ChartSignalsStripData {
  symbol: string;
  fundingRatePct?: number | null;          // 8h-normalised, in %
  openInterestChange24hPct?: number | null; // %
  change24hPct?: number | null;            // %
  longRatio?: number | null;               // 0-1
  shortRatio?: number | null;              // 0-1
  longShortRatio?: number | null;
  rsi?: number | null;                     // 0-100
  atrPct?: number | null;                  // ATR as % of last close
}

interface Signal {
  key: string;
  label: string;
  tone: 'bullish' | 'bearish' | 'neutral' | 'caution';
  icon: React.ReactNode;
  detail?: string;
}

const TONE_STYLE: Record<Signal['tone'], { fg: string; bg: string; border: string }> = {
  bullish: { fg: 'var(--pump-mild)', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.28)' },
  bearish: { fg: 'var(--rekt-mild)', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' },
  caution: { fg: '#f5a623', bg: 'rgba(245,166,35,0.10)', border: 'rgba(245,166,35,0.28)' },
  neutral: { fg: 'var(--fg-muted)', bg: 'rgba(255,255,255,0.04)', border: 'var(--hub-border-subtle)' },
};

function buildSignals(d: ChartSignalsStripData): Signal[] {
  const out: Signal[] = [];

  // 1. Funding regime
  if (d.fundingRatePct != null) {
    const abs = Math.abs(d.fundingRatePct);
    if (abs >= 0.05) {
      out.push({
        key: 'funding-extreme',
        label: d.fundingRatePct > 0 ? 'Funding overheated' : 'Funding deeply negative',
        tone: d.fundingRatePct > 0 ? 'caution' : 'bullish',
        icon: <Flame size={11} />,
        detail: `${d.fundingRatePct >= 0 ? '+' : ''}${d.fundingRatePct.toFixed(4)}%/8h`,
      });
    } else if (abs >= 0.01) {
      out.push({
        key: 'funding-mild',
        label: d.fundingRatePct > 0 ? 'Longs paying' : 'Shorts paying',
        tone: d.fundingRatePct > 0 ? 'bearish' : 'bullish',
        icon: d.fundingRatePct > 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />,
        detail: `${d.fundingRatePct >= 0 ? '+' : ''}${d.fundingRatePct.toFixed(4)}%/8h`,
      });
    } else {
      out.push({
        key: 'funding-flat',
        label: 'Funding neutral',
        tone: 'neutral',
        icon: <Scale size={11} />,
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
        icon: d.openInterestChange24hPct > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />,
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
        icon: d.change24hPct > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />,
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
        icon: <Eye size={11} />,
        detail: `${longPct.toFixed(1)}% long`,
      });
    } else if (longPct <= 35) {
      out.push({
        key: 'ls-short-heavy',
        label: 'Crowded shorts',
        tone: 'caution',
        icon: <Eye size={11} />,
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
      icon: <Snowflake size={11} />,
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
      icon: <AlertTriangle size={11} />,
      detail: 'hot funding · OI dropping',
    });
  }

  // 7. RSI — real TA from Binance perp klines on the active timeframe
  if (d.rsi != null) {
    if (d.rsi >= 75) {
      out.push({ key: 'rsi-overbought', label: 'RSI overbought', tone: 'caution',
        icon: <Gauge size={11} />, detail: d.rsi.toFixed(1) });
    } else if (d.rsi <= 25) {
      out.push({ key: 'rsi-oversold', label: 'RSI oversold', tone: 'bullish',
        icon: <Gauge size={11} />, detail: d.rsi.toFixed(1) });
    }
  }

  // 8. Volatility regime — ATR as % of price; high ATR% = expanded range
  if (d.atrPct != null) {
    if (d.atrPct >= 3) {
      out.push({ key: 'vol-high', label: 'High volatility', tone: 'caution',
        icon: <Activity size={11} />, detail: `ATR ${d.atrPct.toFixed(2)}%` });
    } else if (d.atrPct <= 0.5) {
      out.push({ key: 'vol-compressed', label: 'Volatility compressed', tone: 'neutral',
        icon: <Activity size={11} />, detail: `ATR ${d.atrPct.toFixed(2)}%` });
    }
  }

  return out;
}

export function ChartSignalsStrip({ data }: { data: ChartSignalsStripData }) {
  const signals = buildSignals(data);
  if (signals.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={`Heuristic signals for ${data.symbol}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 14px',
        background: 'rgba(0,0,0,0.4)',
        borderTop: '1px solid var(--hub-border-subtle)',
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}
      className="no-scrollbar"
    >
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
        color: 'var(--fg-muted)', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        SIGNALS · {data.symbol}
      </span>
      <span style={{ width: 1, height: 14, background: 'var(--hub-border-subtle)', margin: '0 4px', flexShrink: 0 }} />
      {signals.map(s => {
        const tone = TONE_STYLE[s.tone];
        return (
          <span key={s.key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 999,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            color: tone.fg,
            fontSize: 10, fontWeight: 700,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {s.icon}
            <span>{s.label}</span>
            {s.detail && (
              <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {s.detail}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
