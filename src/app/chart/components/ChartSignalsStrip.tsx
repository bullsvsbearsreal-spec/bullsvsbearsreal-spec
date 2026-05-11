'use client';

/**
 * Chart signals strip — compact horizontal row of colored "chip"
 * indicators that surface the strongest 4-6 heuristic signals for
 * the current symbol. Sits between the chart and the per-venue
 * funding strip, mirroring the mockup's signal-callout row.
 *
 * Pure presentational — fed by data already in the chart page's
 * derived state. Hides itself when there's no usable signal.
 *
 * The heuristic itself lives in `./signalsBuilder.ts` so it can
 * be unit-tested without a React runtime. This file maps the
 * builder's `iconName` strings to lucide icons + applies tone styling.
 */

import {
  TrendingUp, TrendingDown, Flame, Snowflake, Scale,
  Eye, AlertTriangle, Activity, Gauge,
} from 'lucide-react';
import {
  buildSignals,
  type Signal,
  type SignalIconName,
  type ChartSignalsStripData,
} from './signalsBuilder';

// Re-export types so existing consumers of this module keep working.
export { buildSignals };
export type { Signal, SignalIconName, ChartSignalsStripData };

const TONE_STYLE: Record<Signal['tone'], { fg: string; bg: string; border: string }> = {
  bullish: { fg: 'var(--pump-mild)', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.28)' },
  bearish: { fg: 'var(--rekt-mild)', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' },
  caution: { fg: '#f5a623', bg: 'rgba(245,166,35,0.10)', border: 'rgba(245,166,35,0.28)' },
  neutral: { fg: 'var(--fg-muted)', bg: 'rgba(255,255,255,0.04)', border: 'var(--hub-border-subtle)' },
};

function renderIcon(name: SignalIconName) {
  switch (name) {
    case 'flame':          return <Flame size={11} />;
    case 'trending-up':    return <TrendingUp size={11} />;
    case 'trending-down':  return <TrendingDown size={11} />;
    case 'scale':          return <Scale size={11} />;
    case 'eye':            return <Eye size={11} />;
    case 'snowflake':      return <Snowflake size={11} />;
    case 'alert':          return <AlertTriangle size={11} />;
    case 'gauge':          return <Gauge size={11} />;
    case 'activity':       return <Activity size={11} />;
  }
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
            {renderIcon(s.iconName)}
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
