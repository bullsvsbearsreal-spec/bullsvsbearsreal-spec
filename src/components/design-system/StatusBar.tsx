'use client';
import StreamBars from './StreamBars';
import SatPing from './SatPing';
import LatencyGauge from './LatencyGauge';
import ExchangeStrip from './ExchangeStrip';

interface StatusBarProps { venuesActive?: number; venuesTotal?: number; apiBase?: number; wsBase?: number; version?: string; className?: string; }

export default function StatusBar({ venuesActive = 32, venuesTotal = 32, apiBase = 142, wsBase = 38, version = 'v2.0', className }: StatusBarProps) {
  return (
    <footer className={className} style={{ height: 36, flexShrink: 0, background: 'var(--hub-dark)', borderTop: '1px solid var(--hub-border-subtle)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap', overflow: 'hidden' }} aria-label="System status">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--pump-mild)', fontWeight: 600 }}>
        <StreamBars height={11} bars={4} color="var(--pump-mild)" />Streaming
      </span>
      <span style={{ color: 'var(--fg-muted)' }}>|</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--fg-subtle)' }}>{venuesActive}/{venuesTotal} venues</span>
        <span className="hidden md:inline-flex"><ExchangeStrip compact /></span>
      </span>
      <span style={{ color: 'var(--fg-muted)' }} className="hidden sm:inline">|</span>
      <span className="hidden sm:inline-flex" style={{ gap: 12 }}>
        <LatencyGauge label="api" base={apiBase} spread={18} />
        <LatencyGauge label="ws" base={wsBase} spread={10} />
      </span>
      <div style={{ flex: 1, minWidth: 12 }} />
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
          <line x1="12" y1="9" x2="12" y2="13"/>
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
      <span
        title={`InfoHub ${version}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 9px',
          borderRadius: 999,
          background: 'rgb(var(--hub-accent-rgb) / 0.07)',
          border: '1px solid rgb(var(--hub-accent-rgb) / 0.18)',
          color: 'var(--hub-accent)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          fontSize: 9,
          textTransform: 'uppercase',
          flexShrink: 0,
          marginLeft: 8,
        }}
      >
        <SatPing size={10} color="var(--hub-accent)" />
        InfoHub <span style={{ color: 'var(--hub-accent-light)', fontWeight: 800 }}>{version}</span>
      </span>
    </footer>
  );
}
