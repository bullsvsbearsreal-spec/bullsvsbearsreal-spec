'use client';

/**
 * Bitcoin Halving Countdown widget — small terminal-styled tile that
 * shows the time remaining until the next BTC halving event.
 *
 * Block subsidy schedule (deterministic, hard-coded into Bitcoin):
 *   - Halving 4 (April 19, 2024, block 840,000) → 3.125 BTC/block
 *   - Halving 5 (~April 17, 2028, block 1,050,000) → 1.5625 BTC/block
 *
 * We don't need a block-height feed for this — the date is fixed
 * (real chain re-targets keep ~4-year cadence within hours). The
 * countdown updates client-side every second.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bitcoin, ArrowRight } from 'lucide-react';

export const NEXT_HALVING_ISO = '2028-04-17T00:00:00Z';
export const LAST_HALVING_ISO = '2024-04-19T00:00:00Z';
const NEXT_HALVING_TS = Date.parse(NEXT_HALVING_ISO);
const LAST_HALVING_TS = Date.parse(LAST_HALVING_ISO);
const CYCLE_MS = NEXT_HALVING_TS - LAST_HALVING_TS;

/** Format remaining ms as {days, hours, minutes, seconds}.
 *  Exported for testability — the component math has to handle the
 *  past-the-target case (clamp to 0) without going negative. */
export function partitionMs(ms: number): { d: number; h: number; m: number; s: number } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { d, h, m, s };
}

/** Cycle progress 0..1 for a given `now` timestamp. Useful for the
 *  progress bar — and easy to misuse without bounds. Exported so the
 *  test can lock the clamp behavior. */
export function cycleProgress(now: number): number {
  return Math.min(1, Math.max(0, (now - LAST_HALVING_TS) / CYCLE_MS));
}

export function BtcHalvingCountdown({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = NEXT_HALVING_TS - now;
  const { d, h, m, s } = partitionMs(remaining);
  // Cycle progress 0..1 — how far through the current 4-year cycle we are.
  const progress = cycleProgress(now);

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '4px 10px', borderRadius: 8,
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        fontSize: 11,
      }}>
        <Bitcoin size={12} style={{ color: 'var(--hub-accent)' }} />
        <span style={{ color: 'var(--fg-muted)' }}>Next halving</span>
        <span style={{ color: 'var(--fg-default)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {d}d {String(h).padStart(2, '0')}h
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 12,
      padding: 14,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(247, 147, 26, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bitcoin size={14} style={{ color: '#f7931a' }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--fg-default)',
          }}>
            BTC Halving · 2028
          </span>
        </div>
        <Link
          href="/market-cycle"
          style={{
            fontSize: 10, color: 'var(--fg-muted)', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}
        >
          Cycle <ArrowRight size={9} />
        </Link>
      </div>

      {/* Countdown digits */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'D', value: d, max: 4 },
          { label: 'H', value: h, max: 2 },
          { label: 'M', value: m, max: 2 },
          { label: 'S', value: s, max: 2 },
        ].map(({ label, value, max }) => (
          <div
            key={label}
            style={{
              flex: 1,
              background: 'var(--hub-dark)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 6,
              padding: '8px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontSize: 18, fontWeight: 800, color: 'var(--fg-default)',
              fontFamily: 'var(--font-mono)', lineHeight: 1,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {String(value).padStart(max, '0')}
            </div>
            <div style={{
              fontSize: 8, color: 'var(--fg-subtle)',
              letterSpacing: '0.1em', marginTop: 4,
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Cycle progress bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{
          height: 4,
          background: 'var(--hub-dark)',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #f7931a 0%, #ffb74d 100%)',
            transition: 'width 1s linear',
          }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        fontSize: 9, color: 'var(--fg-subtle)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Subsidy: 3.125 → 1.5625 BTC</span>
        <span>{(progress * 100).toFixed(1)}% through cycle</span>
      </div>
    </div>
  );
}
