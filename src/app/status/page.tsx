'use client';

/**
 * /status — public, unauthenticated status page.
 *
 * Three sections:
 *   1. Top-line — big colored "All systems operational / Degraded / Down"
 *   2. Aggregator — venues connected count
 *   3. Alert engine — per-channel last-fire freshness
 *
 * Polls /api/status every 30 seconds. The endpoint is itself edge-
 * cached so this is cheap. No auth required.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Send, Mail, MessageSquare, Phone, Webhook, Bell } from 'lucide-react';

interface StatusResp {
  status: 'up' | 'degraded' | 'down';
  aggregator: { connected: number; total: number; degraded: number; reachable: boolean };
  api: { responsive: boolean; latencyMs: number };
  alertEngine: { channel: string; lastFire: string | null; sent24h: number }[];
  checkedAt: string;
  checkDurationMs: number;
}

function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function channelIcon(ch: string) {
  const lower = ch.toLowerCase();
  if (lower.startsWith('telegram')) return <Send style={{ width: 14, height: 14 }} />;
  if (lower.startsWith('email'))    return <Mail style={{ width: 14, height: 14 }} />;
  if (lower.startsWith('discord'))  return <MessageSquare style={{ width: 14, height: 14 }} />;
  if (lower.startsWith('sms') || lower.includes('whatsapp')) return <Phone style={{ width: 14, height: 14 }} />;
  if (lower.startsWith('webhook'))  return <Webhook style={{ width: 14, height: 14 }} />;
  return <Bell style={{ width: 14, height: 14 }} />;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/status', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then(d => { if (!cancelled) { setData(d); setError(null); } })
        .catch(e => { if (!cancelled) setError(e.message ?? 'Network error'); });
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const tone =
    !data ? { color: '#9ca3af', icon: <RefreshCw style={{ width: 28, height: 28 }} className="animate-spin" />, label: 'Checking…' } :
    data.status === 'up'       ? { color: '#22c55e', icon: <CheckCircle2 style={{ width: 28, height: 28 }} />, label: 'All systems operational' } :
    data.status === 'degraded' ? { color: '#f59e0b', icon: <AlertTriangle style={{ width: 28, height: 28 }} />, label: 'Degraded performance' } :
                                 { color: '#ef4444', icon: <XCircle style={{ width: 28, height: 28 }} />, label: 'Service disruption' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', padding: '60px 20px', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 12, color: '#a3a3a3', textDecoration: 'none' }}>← info-hub.io</a>

        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 24, marginBottom: 8 }}>
          System Status
        </h1>
        <p style={{ fontSize: 13, color: '#a3a3a3', marginBottom: 32 }}>
          Live health of the InfoHub data pipeline. Refreshes every 30 seconds.
        </p>

        {/* Top-line status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 22px',
          background: `${tone.color}10`,
          border: `1px solid ${tone.color}55`,
          borderRadius: 12,
          marginBottom: 24,
        }}>
          <span style={{ color: tone.color }}>{tone.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{tone.label}</div>
            {data && (
              <div style={{ fontSize: 11, color: '#a3a3a3', marginTop: 2, fontFamily: 'var(--font-mono, ui-monospace)' }}>
                Checked {fmtAgo(data.checkedAt)} · {data.checkDurationMs}ms
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
            Could not reach the status endpoint: {error}
          </div>
        )}

        {/* Aggregator */}
        <Section title="Market data aggregator">
          {!data ? <Skeleton h={56} /> : (
            <Row
              label="WS venues connected"
              value={`${data.aggregator.connected}/${data.aggregator.total}`}
              sub={data.aggregator.degraded > 0 ? `${data.aggregator.degraded} stale (>60s)` : 'all venues up-to-date'}
              tone={
                !data.aggregator.reachable ? 'down' :
                data.aggregator.connected < data.aggregator.total || data.aggregator.degraded > 0 ? 'degraded' : 'up'
              }
            />
          )}
        </Section>

        {/* API */}
        <Section title="Public API">
          {!data ? <Skeleton h={56} /> : (
            <Row
              label="Database + read path"
              value={data.api.responsive ? `${data.api.latencyMs}ms` : '—'}
              sub={data.api.responsive ? 'DB responsive' : 'DB unreachable'}
              tone={data.api.responsive ? 'up' : 'down'}
            />
          )}
        </Section>

        {/* Alert engine */}
        <Section title="Alert engine · last fire per channel">
          {!data ? <Skeleton h={120} /> : data.alertEngine.length === 0 ? (
            <Row label="No alerts fired in last 7 days" value="—" sub="quiet" tone="up" />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.alertEngine.map(ch => {
                const ageMs = ch.lastFire ? Date.now() - new Date(ch.lastFire).getTime() : Infinity;
                const channelTone: 'up' | 'degraded' | 'down' =
                  ageMs < 24 * 3600_000 ? 'up' :
                  ageMs < 7 * 24 * 3600_000 ? 'degraded' : 'down';
                return (
                  <Row
                    key={ch.channel}
                    icon={channelIcon(ch.channel)}
                    label={ch.channel.charAt(0).toUpperCase() + ch.channel.slice(1)}
                    value={`${ch.sent24h} in 24h`}
                    sub={ch.lastFire ? `last fired ${fmtAgo(ch.lastFire)}` : 'never'}
                    tone={channelTone}
                  />
                );
              })}
            </div>
          )}
        </Section>

        <p style={{ fontSize: 11, color: '#666', marginTop: 40, textAlign: 'center' }}>
          Need help? <a href="https://t.me/info_hub69" style={{ color: '#7dd3fc' }}>@info_hub69</a> on Telegram.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#737373', marginBottom: 8 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ icon, label, value, sub, tone }: {
  icon?: React.ReactNode; label: string; value: string; sub?: string; tone: 'up' | 'degraded' | 'down';
}) {
  const toneColor = tone === 'up' ? '#22c55e' : tone === 'degraded' ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '12px auto 1fr auto',
      alignItems: 'center', gap: 12,
      padding: '14px 16px',
      background: '#171717',
      border: '1px solid #262626',
      borderRadius: 10,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor, boxShadow: `0 0 5px ${toneColor}` }} />
      {icon ? <span style={{ color: '#a3a3a3' }}>{icon}</span> : <span />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#a3a3a3', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono, ui-monospace)', fontWeight: 700, color: '#fff', textAlign: 'right' }}>
        {value}
      </div>
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return (
    <div style={{
      height: h, borderRadius: 10,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  );
}
