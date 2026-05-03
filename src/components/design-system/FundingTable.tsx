'use client';
import { ExchangeLogo } from '@/components/ExchangeLogos';

export interface FundingTableRow {
  symbol: string;
  venue: string;
  price: number;
  funding: number;
  oi: string;
  ls: number;
  chg: number;
  iconBg?: string;
}

interface FundingTableProps {
  rows: FundingTableRow[];
  title?: string;
  period?: string;
  updatedAgo?: string;
  venueCount?: number;
  selectedSymbol?: string | null;
  onRowClick?: (row: FundingTableRow) => void;
  onPeriodChange?: (period: string) => void;
  className?: string;
}

const COLS = '32px 1.4fr 1fr 1fr 1fr 0.8fr 1fr';

export default function FundingTable({ rows, title = 'Top Funding', period = '8h', updatedAgo, venueCount = 33, selectedSymbol, onRowClick, onPeriodChange, className }: FundingTableProps) {
  return (
    <div className={className} style={{ background: 'var(--hub-darker)', border: '1px solid var(--hub-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--hub-border-subtle)', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>{title}</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          {venueCount} exchanges · {period} period{updatedAgo ? ` · updated ${updatedAgo}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', background: 'var(--hub-black)', border: '1px solid var(--hub-border)', borderRadius: 7, padding: 2 }}>
          {['8h', '1d', '1w'].map(t => (
            <button key={t} type="button" onClick={() => onPeriodChange?.(t)} style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 5, cursor: 'pointer', background: t === period ? 'var(--hub-secondary-medium)' : 'transparent', color: t === period ? 'var(--fg-default)' : 'var(--fg-muted)' }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '8px 16px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--hub-border)', fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
        <div>#</div><div>Pair</div>
        <div style={{ textAlign: 'right' }}>Price</div>
        <div style={{ textAlign: 'right' }}>Funding</div>
        <div style={{ textAlign: 'right' }}>OI</div>
        <div style={{ textAlign: 'right' }}>L/S</div>
        <div style={{ textAlign: 'right' }}>24h</div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>Loading funding rates…</div>
      ) : rows.map((r, i) => {
        const on = r.symbol === selectedSymbol;
        const stripeBg = i % 2 ? 'transparent' : 'rgba(255,255,255,0.015)';
        return (
          <div key={`${r.symbol}-${r.venue}`} onClick={() => onRowClick?.(r)} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '10px 16px', paddingLeft: on ? 14 : 16, alignItems: 'center', borderBottom: '1px solid var(--hub-border-subtle)', background: on ? 'rgba(255,165,0,0.06)' : stripeBg, cursor: onRowClick ? 'pointer' : 'default', fontSize: 12, borderLeft: on ? '2px solid var(--hub-accent)' : '2px solid transparent', transition: 'background 120ms' }}
            onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.background = stripeBg; }}>
            <div style={{ color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>{i + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: r.iconBg || 'linear-gradient(135deg,#f7931a,#ffb547)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-sans)' }}>{r.symbol[0]}</div>
              <div>
                <span style={{ color: 'var(--fg-default)', fontWeight: 600 }}>{r.symbol}</span>
                <span style={{ color: 'var(--fg-subtle)', fontSize: 9, marginLeft: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
                  <ExchangeLogo exchange={r.venue.toLowerCase()} size={11} />{r.venue}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums' }}>${r.price.toLocaleString(undefined, { maximumFractionDigits: r.price < 1 ? 4 : 2 })}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: Math.abs(r.funding) > 0.15 ? 'var(--hub-accent-light)' : r.funding > 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>{r.funding >= 0 ? '+' : ''}{r.funding.toFixed(4)}%</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.oi}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.ls >= 1 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontVariantNumeric: 'tabular-nums' }}>{r.ls.toFixed(2)}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: r.chg >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)', fontWeight: 600 }}>{r.chg >= 0 ? '+' : ''}{r.chg.toFixed(2)}%</div>
          </div>
        );
      })}
    </div>
  );
}
