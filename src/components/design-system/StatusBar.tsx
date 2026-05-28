'use client';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import StreamBars from './StreamBars';
import SatPing from './SatPing';
import LatencyGauge from './LatencyGauge';
import ExchangeStrip from './ExchangeStrip';
import ThroughputCounter from './ThroughputCounter';
import SupportChat from '@/components/SupportChat';
import { useAggregatorHealth } from '@/hooks/useAggregatorHealth';

interface StatusBarProps { version?: string; className?: string; }

/** Reusable thin separator between status-bar groups */
function Sep({ hidden }: { hidden?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={hidden === 'sm' ? 'hidden sm:inline-block' : hidden === 'md' ? 'hidden md:inline-block' : undefined}
      style={{ width: 1, height: 14, background: 'var(--hub-border)', opacity: 0.5, flexShrink: 0 }}
    />
  );
}

/** Streaming/degraded/offline badge — was previously hardcoded to
 *  always read "STREAMING" in green regardless of actual aggregator
 *  health. Now reads from the shared useAggregatorHealth hook. */
function StreamStatusBadge() {
  const { status } = useAggregatorHealth();

  const config = {
    streaming: { label: 'STREAMING', color: 'var(--pump-mild)' },
    degraded:  { label: 'DEGRADED',  color: 'var(--hub-accent)' },
    offline:   { label: 'OFFLINE',   color: 'var(--rekt-mild)' },
    unknown:   { label: 'CONNECTING', color: 'var(--fg-muted)' },
  }[status];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      color: config.color, fontWeight: 700, letterSpacing: '0.06em',
    }}>
      <StreamBars height={11} bars={4} color={config.color} />
      <span>{config.label}</span>
    </span>
  );
}

export default function StatusBar({ version = 'v2.0', className }: StatusBarProps) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  // The version badge links to /changelog, but the changelog is admin-gated
  // at runtime (5daf10c6). For non-admins, fall back to /faq (which the FAQ
  // entries reference "What's new" / "Recently shipped" via the changelog
  // mention) so the badge isn't a dead-end UX click.
  const versionHref = isAdmin ? '/changelog' : '/faq';
  const versionTitle = isAdmin
    ? `InfoHub ${version} — view changelog`
    : `InfoHub ${version}`;
  return (
    <footer
      className={className}
      style={{
        height: 36, flexShrink: 0,
        background: 'linear-gradient(180deg, var(--hub-dark) 0%, rgba(0,0,0,0.4) 100%)',
        borderTop: '1px solid var(--hub-border-subtle)',
        display: 'flex', alignItems: 'center',
        padding: '0 18px', gap: 12,
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
        whiteSpace: 'nowrap', overflow: 'hidden',
      }}
      aria-label="System status"
    >
      <StreamStatusBadge />
      <Sep />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {/* Real venue count from aggregator /health — same shared
            hook the STREAMING badge above uses. */}
        <ThroughputCounter />
        <span className="hidden md:inline-flex"><ExchangeStrip compact /></span>
      </span>

      <Sep hidden="sm" />

      {/* Real-time API latency. WS gauge removed — no single WebSocket
          to honestly ping (each user holds 6-12 concurrent venue WS) and
          the previous implementation was a random-jitter fake. The api
          gauge measures actual round-trip to /api/v1/status. */}
      <span className="hidden sm:inline-flex" style={{ gap: 12 }}>
        <LatencyGauge label="api" url="/api/v1/status" />
      </span>

      <div style={{ flex: 1, minWidth: 12 }} />

      {/* Compliance reminder (large screens only) */}
      <span
        className="hidden 2xl:inline-flex"
        style={{
          alignItems: 'center', gap: 6,
          color: 'var(--fg-faint)', fontSize: 9,
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          flexShrink: 0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--rekt-mild)', opacity: 0.6, flexShrink: 0 }}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9"  x2="12"    y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>
          Not financial advice
          <span style={{ color: 'var(--hub-border)', margin: '0 6px' }}>·</span>
          Third-party data
          <span style={{ color: 'var(--hub-border)', margin: '0 6px' }}>·</span>
          DYOR
        </span>
      </span>

      {/* Version badge — links to /changelog for admins, /faq otherwise */}
      <Link
        href={versionHref}
        title={versionTitle}
        className="status-bar-version"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 9px', borderRadius: 999,
          background: 'rgb(var(--hub-accent-rgb) / 0.07)',
          border: '1px solid rgb(var(--hub-accent-rgb) / 0.18)',
          color: 'var(--hub-accent)',
          fontWeight: 700, letterSpacing: '0.04em', fontSize: 9,
          textTransform: 'uppercase', flexShrink: 0,
          marginLeft: 4,
          textDecoration: 'none',
          transition: 'background 150ms, border-color 150ms, transform 150ms',
        }}
      >
        <SatPing size={10} color="var(--hub-accent)" />
        InfoHub <span style={{ color: 'var(--hub-accent-light)', fontWeight: 800 }}>{version}</span>
      </Link>

      {/* Support chat — sits next to the InfoHub badge so it's findable
          from every page. The component handles its own logged-out state
          + side panel; we just render the trigger button here. */}
      <SupportChat />

      <style jsx>{`
        .status-bar-version:hover {
          background: rgb(var(--hub-accent-rgb) / 0.14) !important;
          border-color: rgb(var(--hub-accent-rgb) / 0.35) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </footer>
  );
}
