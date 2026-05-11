'use client';

/**
 * Chart compare strip — single-row band showing the active symbol's
 * 24h performance relative to BTC, ETH, and SOL (the three crypto
 * "majors"). When the active symbol IS one of the majors, that column
 * is suppressed so the row doesn't look like a tautology
 * ("BTC vs BTC: 0%").
 *
 * Data shape passed in is intentionally minimal — caller passes the
 * map of symbol → 24h change %, the strip handles the rest.
 *
 * Why: gives the trader instant context for whether a 3% move on PEPE
 * is alpha or just beta. PEPE +3% while BTC +5% means PEPE is
 * underperforming the market — a different read than "PEPE is mooning".
 */

import { TrendingUp, TrendingDown } from 'lucide-react';

export interface ChartCompareData {
  symbol: string;
  /** 24h price-change % for the active symbol. Null = not yet loaded. */
  selfChange24h: number | null;
  /** Map of major symbol ("BTC" / "ETH" / "SOL") → 24h change %. */
  majors: Partial<Record<'BTC' | 'ETH' | 'SOL', number | null>>;
}

const MAJORS: ('BTC' | 'ETH' | 'SOL')[] = ['BTC', 'ETH', 'SOL'];

export function ChartCompareStrip({ data }: { data: ChartCompareData }) {
  const self = data.selfChange24h;
  // Avoid "BTC vs BTC" rows
  const peers = MAJORS.filter(m => m !== data.symbol.toUpperCase());

  if (peers.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={`${data.symbol} 24h performance vs majors`}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '4px 14px',
        background: 'var(--hub-darker)',
        borderTop: '1px solid var(--hub-border-subtle)',
        fontFamily: 'var(--font-mono)',
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
      }}>
        COMPARE · 24H vs MAJORS
      </span>
      {peers.map(peer => {
        const peerChange = data.majors[peer];
        if (self == null || peerChange == null) {
          return (
            <span key={peer} style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              color: 'var(--fg-muted)', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontWeight: 700 }}>{peer}</span>
              <span>—</span>
            </span>
          );
        }
        const delta = self - peerChange;
        const outperform = delta >= 0;
        const color = outperform ? 'var(--pump-mild)' : 'var(--rekt-mild)';
        const Icon = outperform ? TrendingUp : TrendingDown;
        return (
          <span key={peer} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap',
          }}>
            <span style={{ color: 'var(--fg-muted)', fontWeight: 700 }}>{peer}</span>
            <Icon size={10} style={{ color }} />
            <span style={{ color, fontWeight: 700 }}>
              {outperform ? '+' : ''}{delta.toFixed(2)}%
            </span>
            <span style={{ color: 'var(--fg-subtle)', fontSize: 9 }}>
              ({peerChange >= 0 ? '+' : ''}{peerChange.toFixed(2)}%)
            </span>
          </span>
        );
      })}
    </div>
  );
}
