'use client';

/**
 * Chart terminal strips — three Bloomberg/TradingView-style horizontal
 * info bands that sit ABOVE and BELOW the TradingView chart:
 *
 *   1. <ChartStatsBar>         — dense stat columns (24H H/L, VOL, OI,
 *                                 FUNDING countdown, L/S, MARK/INDEX,
 *                                 RSI/ATR). Above the chart.
 *   2. <ChartAiStrip>          — single-line market commentary with
 *                                 a "HUB AI" badge, mock-AI for now.
 *                                 Below the stats bar.
 *   3. <ChartVenueFundingStrip>— per-venue funding rate cards
 *                                 (Binance / Bybit / OKX / Bitget /
 *                                 Hyperliquid / Deribit / …). Below
 *                                 the chart.
 *
 * Each component is data-driven and degrades cleanly to dashes/
 * skeletons when its upstream signal is missing.
 */

import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils/format';

/* ─── Shared formatters ───────────────────────────────────────────── */

function fmtCompactUsd(v: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = opts.sign && v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined, opts: { digits?: number; sign?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const d = opts.digits ?? 2;
  const sign = opts.sign && v > 0 ? '+' : v < 0 ? '' : opts.sign ? '+' : ''; // '-' comes from toFixed
  return `${sign}${v.toFixed(d)}%`;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── 1. Stats bar ────────────────────────────────────────────────── */

export interface ChartStatsBarData {
  symbol: string;                // 'BTC'
  pair?: string;                 // '/USDT'
  venue?: string;                // 'BINANCE'
  instrumentTag?: string;        // 'PERP'
  leverage?: number;             // 100
  price: number | null;
  change24hUsd?: number | null;
  change24hPct?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  volume24hUsd?: number | null;
  volume24hCoin?: number | null;
  openInterestUsd?: number | null;
  openInterestChange24hPct?: number | null;
  fundingRatePct?: number | null;   // current funding, %
  nextFundingAt?: number | null;    // ms epoch
  longRatio?: number | null;        // 0..1 (0.543 = 54.3%)
  shortRatio?: number | null;
  longShortRatio?: number | null;   // long / short
  markPrice?: number | null;
  indexPrice?: number | null;
  basisPct?: number | null;
  rsi?: number | null;
  atr?: number | null;
}

export function ChartStatsBar({ data }: { data: ChartStatsBarData }) {
  const positive = (data.change24hPct ?? 0) >= 0;
  const priceColor = positive ? 'var(--pump-mild)' : 'var(--rekt-mild)';

  // Live countdown to next funding window
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!data.nextFundingAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data.nextFundingAt]);
  const fundingCountdown = data.nextFundingAt ? fmtCountdown(data.nextFundingAt - now) : null;

  // Mark vs index basis (when both present and basisPct not supplied)
  const computedBasisPct = (() => {
    if (data.basisPct != null) return data.basisPct;
    if (data.markPrice != null && data.indexPrice != null && data.indexPrice > 0) {
      return ((data.markPrice - data.indexPrice) / data.indexPrice) * 100;
    }
    return null;
  })();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        padding: '8px 14px',
        background: 'var(--hub-darker)',
        borderBottom: '1px solid var(--hub-border-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      className="no-scrollbar"
    >
      {/* Symbol / venue / instrument */}
      <StatGroup wide>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}>
            {data.symbol}{data.pair ?? ''}
          </span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', gap: 6 }}>
          {data.venue && <span>{data.venue}</span>}
          {data.instrumentTag && <span style={{ color: 'var(--hub-accent)' }}>· {data.instrumentTag}</span>}
          {data.leverage && <span>· {data.leverage}x</span>}
        </div>
      </StatGroup>

      {/* Price + 24h change */}
      <StatGroup wide>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-default)', letterSpacing: '-0.02em' }}>
          {data.price != null ? formatPrice(data.price) : <SkeletonValue width={80} />}
        </div>
        {data.change24hUsd != null && data.change24hPct != null ? (
          <div style={{ display: 'flex', gap: 6, fontSize: 11, fontWeight: 700, color: priceColor }}>
            <span>{fmtCompactUsd(data.change24hUsd, { sign: true })}</span>
            <span>{fmtPct(data.change24hPct, { sign: true })}</span>
          </div>
        ) : <SkeletonValue width={70} />}
      </StatGroup>

      {/* 24H H · L */}
      <StatGroup label="24H H · L">
        <div>
          <span style={{ color: 'var(--pump-mild)' }}>{data.high24h != null ? formatPrice(data.high24h) : '—'}</span>
        </div>
        <div style={{ color: 'var(--rekt-mild)' }}>{data.low24h != null ? formatPrice(data.low24h) : '—'}</div>
      </StatGroup>

      {/* 24H VOL */}
      <StatGroup label="24H VOL">
        <div style={{ color: 'var(--fg-default)' }}>{fmtCompactUsd(data.volume24hUsd ?? null)}</div>
        <div style={{ color: 'var(--fg-muted)', fontSize: 10 }}>
          {data.volume24hCoin != null
            ? `${data.volume24hCoin.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${data.symbol}`
            : '—'}
        </div>
      </StatGroup>

      {/* OI */}
      <StatGroup label={`OI · ${data.symbol}`}>
        <div style={{ color: 'var(--fg-default)' }}>{fmtCompactUsd(data.openInterestUsd ?? null)}</div>
        <div style={{
          color: (data.openInterestChange24hPct ?? 0) >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)',
          fontSize: 10,
        }}>
          {data.openInterestChange24hPct != null
            ? `${data.openInterestChange24hPct >= 0 ? '+' : ''}${data.openInterestChange24hPct.toFixed(2)}%`
            : '—'}
        </div>
      </StatGroup>

      {/* Funding + countdown */}
      <StatGroup label="FUNDING · 8H">
        <div style={{ color: (data.fundingRatePct ?? 0) >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>
          {data.fundingRatePct != null
            ? `${data.fundingRatePct >= 0 ? '+' : ''}${data.fundingRatePct.toFixed(4)}%`
            : '—'}
        </div>
        <div style={{ color: 'var(--fg-muted)', fontSize: 10 }}>
          {fundingCountdown ? `in ${fundingCountdown}` : '—'}
        </div>
      </StatGroup>

      {/* L/S ratio */}
      <StatGroup label="L/S RATIO">
        <div style={{ color: 'var(--fg-default)' }}>
          {data.longShortRatio != null ? data.longShortRatio.toFixed(2) : '—'}
        </div>
        <div style={{ fontSize: 10 }}>
          {data.longRatio != null && data.shortRatio != null ? (
            <>
              <span style={{ color: 'var(--pump-mild)' }}>{(data.longRatio * 100).toFixed(1)}%</span>
              <span style={{ color: 'var(--fg-subtle)' }}> · </span>
              <span style={{ color: 'var(--rekt-mild)' }}>{(data.shortRatio * 100).toFixed(1)}%</span>
            </>
          ) : '—'}
        </div>
      </StatGroup>

      {/* Mark · Index · Basis */}
      <StatGroup label="MARK · INDEX">
        <div style={{ color: 'var(--fg-default)' }}>
          {data.markPrice != null ? formatPrice(data.markPrice) : '—'}
        </div>
        <div style={{
          color: (computedBasisPct ?? 0) >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)',
          fontSize: 10,
        }}>
          {computedBasisPct != null
            ? `basis ${computedBasisPct >= 0 ? '+' : ''}${computedBasisPct.toFixed(3)}%`
            : '—'}
        </div>
      </StatGroup>

      {/* RSI · ATR */}
      <StatGroup label="RSI · ATR">
        <div style={{
          color: data.rsi == null ? 'var(--fg-muted)'
            : data.rsi >= 70 ? 'var(--rekt-mild)'
            : data.rsi <= 30 ? 'var(--pump-mild)'
            : 'var(--fg-default)',
        }}>
          {data.rsi != null ? data.rsi.toFixed(1) : '—'}
        </div>
        <div style={{ color: 'var(--fg-muted)', fontSize: 10 }}>
          {data.atr != null ? `ATR ${data.atr.toFixed(1)}` : '—'}
        </div>
      </StatGroup>
    </div>
  );
}

function StatGroup({ label, children, wide }: {
  label?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      padding: '0 14px',
      borderRight: '1px solid var(--hub-border-subtle)',
      minWidth: wide ? 140 : 90,
      whiteSpace: 'nowrap',
    }}>
      {label && (
        <span style={{
          fontSize: 9, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--fg-subtle)',
          marginBottom: 1,
        }}>{label}</span>
      )}
      {children}
    </div>
  );
}

function SkeletonValue({ width }: { width: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width, height: 14,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
      backgroundSize: '200% 100%',
      borderRadius: 3,
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} aria-hidden />
  );
}

/* ─── 2. AI commentary strip ──────────────────────────────────────── */

export interface ChartAiStripData {
  /** Symbol the commentary is about, used to refresh copy when changing symbols. */
  symbol: string;
  /** Optional pre-computed signals to influence the canned analysis below.
   *  When omitted, the strip falls back to a static "warming up" line. */
  fundingRatePct?: number | null;
  openInterestChange24hPct?: number | null;
  change24hPct?: number | null;
  price?: number | null;
}

export function ChartAiStrip({ data }: { data: ChartAiStripData }) {
  // Build a deterministic one-liner from the available signals.
  // No actual model call — this is heuristic commentary surfacing the
  // strongest 1-2 facts. Real ChatGPT/Claude integration is a follow-up.
  const insight = (() => {
    const bits: string[] = [];
    const f = data.fundingRatePct;
    const oi = data.openInterestChange24hPct;
    const ch = data.change24hPct;
    if (f != null && Math.abs(f) >= 0.02) {
      bits.push(f > 0
        ? `Funding hot (+${f.toFixed(4)}%) — longs paying.`
        : `Funding negative (${f.toFixed(4)}%) — shorts paying.`);
    } else if (f != null) {
      bits.push(`Funding cooling off (+${f.toFixed(4)}%).`);
    }
    if (oi != null && Math.abs(oi) >= 1) {
      bits.push(oi > 0
        ? `OI still +${oi.toFixed(1)}% on 24h.`
        : `OI down ${oi.toFixed(1)}% — positions unwinding.`);
    }
    if (ch != null && Math.abs(ch) >= 2) {
      bits.push(ch > 0
        ? `Spot up ${ch.toFixed(2)}% on the day.`
        : `Spot down ${Math.abs(ch).toFixed(2)}% on the day.`);
    }
    if (bits.length === 0) {
      return `Warming up — watching ${data.symbol} for direction.`;
    }
    return bits.slice(0, 2).join(' ');
  })();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 14px',
      background: 'rgba(255,165,0,0.04)',
      borderBottom: '1px solid var(--hub-border-subtle)',
      fontSize: 11,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 7px', borderRadius: 4,
        background: 'rgba(255,165,0,0.18)',
        color: 'var(--hub-accent)',
        fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
        HUB AI
      </span>
      <span style={{ flex: 1, color: 'var(--fg-default)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {insight}
      </span>
      <span style={{ fontSize: 9, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
        updated &lt;1m ago
      </span>
      <button
        type="button"
        style={{
          padding: '3px 9px', borderRadius: 6,
          background: 'transparent',
          border: '1px solid var(--hub-border)',
          color: 'var(--fg-muted)',
          fontSize: 10, fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        Ask follow-up →
      </button>
    </div>
  );
}

/* ─── 3. Per-venue funding strip (bottom) ─────────────────────────── */

export interface VenueFundingRow {
  venue: string;
  fundingPct: number | null;     // current funding, %
  fundingChangeBps?: number | null; // change in bps from prior tick (optional)
  openInterestUsd?: number | null;
  /** Optional inline icon (1-3 char glyph from venue name) — purely decorative. */
  glyph?: string;
  glyphBg?: string;
}

const DEFAULT_VENUE_PALETTE: Record<string, string> = {
  Binance:      '#f3ba2f',
  Bybit:        '#f7a600',
  OKX:          '#000000',
  Bitget:       '#5a7cdb',
  Hyperliquid:  '#50d2c1',
  Deribit:      '#3d7eff',
  Kraken:       '#5742d2',
  KuCoin:       '#23b58a',
  Coinbase:     '#0052ff',
  HTX:          '#3b82f6',
  'Gate.io':    '#2354e6',
};

export function ChartVenueFundingStrip({ rows, symbol }: { rows: VenueFundingRow[]; symbol: string }) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: '8px 14px',
        background: 'var(--hub-darker)',
        borderTop: '1px solid var(--hub-border-subtle)',
        fontSize: 10,
        color: 'var(--fg-muted)',
      }}>
        FUNDING · waiting for venue data…
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      padding: '8px 14px',
      background: 'var(--hub-darker)',
      borderTop: '1px solid var(--hub-border-subtle)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      overflowX: 'auto',
      scrollbarWidth: 'none',
      gap: 6,
    }}
    className="no-scrollbar"
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px 0 4px',
        borderRight: '1px solid var(--hub-border-subtle)',
        marginRight: 4,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
          color: 'var(--fg-muted)', textTransform: 'uppercase',
        }}>
          FUNDING · {rows.length} VENUES
        </span>
        <span style={{ fontSize: 9, color: 'var(--fg-subtle)' }}>
          {symbol}
        </span>
      </div>
      {rows.map(r => {
        const positive = (r.fundingPct ?? 0) >= 0;
        const color = positive ? 'var(--pump-mild)' : 'var(--rekt-mild)';
        const palette = DEFAULT_VENUE_PALETTE[r.venue] ?? 'var(--hub-border)';
        const glyph = r.glyph ?? r.venue.slice(0, 1).toUpperCase();
        return (
          <div key={r.venue} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 10px', borderRadius: 6,
            background: 'var(--hub-dark)',
            border: '1px solid var(--hub-border-subtle)',
            whiteSpace: 'nowrap',
            minWidth: 140,
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              background: r.glyphBg ?? palette,
              color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800,
              flexShrink: 0,
            }}>
              {glyph}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-default)' }}>{r.venue}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
                  {r.fundingPct != null
                    ? `${r.fundingPct >= 0 ? '+' : ''}${r.fundingPct.toFixed(4)}%`
                    : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 7, fontSize: 9, color: 'var(--fg-subtle)' }}>
                {r.openInterestUsd != null && (
                  <span>OI {fmtCompactUsd(r.openInterestUsd)}</span>
                )}
                {r.fundingChangeBps != null && (
                  <span style={{ color: r.fundingChangeBps >= 0 ? 'var(--pump-mild)' : 'var(--rekt-mild)' }}>
                    {r.fundingChangeBps >= 0 ? '+' : ''}{r.fundingChangeBps.toFixed(1)} bps
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
