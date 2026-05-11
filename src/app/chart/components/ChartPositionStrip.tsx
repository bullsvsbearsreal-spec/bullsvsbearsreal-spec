'use client';

/**
 * Chart position strip — terminal-style band shown above the chart
 * when the signed-in user has an open position on the currently-
 * viewed symbol. Mirrors the mockup's LONG/SHORT pill + entry / mark
 * / liq / size / PnL columns with a "Manage →" link to /positions.
 *
 * Renders nothing when:
 *   - the user isn't signed in (401 from /api/account/positions)
 *   - the user is signed in but has no position matching `symbol`
 *
 * The strip subscribes to its own poll (60s) so it stays cheap when
 * the user is just browsing charts without any open positions.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface ApiPosition {
  id: number;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  liquidationPrice: number | null;
}

interface ApiResponse {
  positions: ApiPosition[];
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  if (Math.abs(n) >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtSize(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

function fmtUsd(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : '';
  if (Math.abs(n) >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${n.toFixed(2)}`;
}

export function ChartPositionStrip({ symbol }: { symbol: string }) {
  const [positions, setPositions] = useState<ApiPosition[] | null>(null);
  // null = haven't loaded yet, [] = loaded but empty (no open positions / signed out)

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/account/positions', { signal: AbortSignal.timeout(10000) });
        if (cancelled) return;
        if (res.status === 401) { setPositions([]); return; }
        if (!res.ok) { setPositions([]); return; }
        const json = (await res.json()) as ApiResponse;
        setPositions(Array.isArray(json.positions) ? json.positions : []);
      } catch {
        if (!cancelled) setPositions([]);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (positions == null || positions.length === 0) return null;

  // Match positions by base symbol (strip USDT/USD/PERP suffixes in either direction).
  // A user viewing "BTC" should match positions stored as "BTC", "BTCUSDT", "BTC-PERP", etc.
  const target = symbol.toUpperCase().replace(/USDT$|USD$|-PERP$|PERP$/i, '');
  const matched = positions.filter(p => {
    const ps = p.symbol.toUpperCase().replace(/USDT$|USD$|-PERP$|PERP$/i, '');
    return ps === target;
  });

  if (matched.length === 0) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderBottom: '1px solid var(--hub-border-subtle)',
      flexShrink: 0,
    }}>
      {matched.map(p => (
        <PositionRow key={`${p.exchange}-${p.id}`} p={p} />
      ))}
    </div>
  );
}

function PositionRow({ p }: { p: ApiPosition }) {
  const isLong = p.side === 'long';
  const sideColor = isLong ? 'var(--pump-mild)' : 'var(--rekt-mild)';
  const pnl = p.unrealizedPnl;
  const pnlPct = (pnl != null && p.positionValue != null && p.positionValue !== 0)
    ? (pnl / Math.abs(p.positionValue)) * 100
    : null;
  const pnlColor = (pnl ?? 0) >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '4px 14px',
      background: 'rgba(0,0,0,0.5)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      overflowX: 'auto',
      scrollbarWidth: 'none',
      lineHeight: 1.2,
    }} className="no-scrollbar">
      {/* LONG / SHORT pill + exchange */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 14, borderRight: '1px solid var(--hub-border-subtle)' }}>
        <span style={{
          padding: '2px 8px', borderRadius: 4,
          background: isLong ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
          color: sideColor,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
        }}>
          {p.side.toUpperCase()}
          {p.leverage != null && p.leverage > 0 ? ` · ${p.leverage.toFixed(0)}x` : ''}
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {p.exchange}
        </span>
      </div>

      {/* Size */}
      <Cell label="SIZE">
        <div style={{ color: 'var(--fg-default)' }}>{fmtSize(p.size)}</div>
        <div style={{ color: 'var(--fg-muted)', fontSize: 10 }}>{fmtUsd(p.positionValue)}</div>
      </Cell>

      {/* Entry */}
      <Cell label="ENTRY">
        <div style={{ color: 'var(--fg-default)' }}>{fmtPrice(p.entryPrice)}</div>
      </Cell>

      {/* Mark */}
      <Cell label="MARK">
        <div style={{ color: 'var(--fg-default)' }}>{fmtPrice(p.markPrice)}</div>
      </Cell>

      {/* Liq */}
      <Cell label="LIQ">
        <div style={{ color: p.liquidationPrice != null ? 'var(--rekt-mild)' : 'var(--fg-muted)' }}>
          {fmtPrice(p.liquidationPrice)}
        </div>
      </Cell>

      {/* P&L */}
      <Cell label="P&L">
        <div style={{ color: pnlColor }}>{fmtUsd(pnl, { sign: true })}</div>
        <div style={{ color: pnlColor, fontSize: 10 }}>
          {pnlPct != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
        </div>
      </Cell>

      <div style={{ flex: 1 }} />

      {/* Manage CTA */}
      <Link
        href="/positions"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'transparent',
          border: '1px solid var(--hub-border)',
          color: 'var(--fg-muted)',
          fontSize: 10, fontFamily: 'var(--font-sans)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Manage <ExternalLink size={10} />
      </Link>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-chart-cell="" style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      padding: '0 12px',
      borderRight: '1px solid var(--hub-border-subtle)',
      minWidth: 86,
      whiteSpace: 'nowrap',
      lineHeight: 1.2,
      justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--fg-subtle)',
        marginBottom: 0,
        lineHeight: 1.2,
      }}>{label}</span>
      {children}
    </div>
  );
}
