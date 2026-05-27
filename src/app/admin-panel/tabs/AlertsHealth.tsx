'use client';

/**
 * Alerts Health tab — per-channel send velocity + active-alert
 * distribution + last-fire freshness.
 *
 * Source: alert_notifications + user_prefs.prefs->'alerts' jsonb +
 * push_subscriptions / telegram links.
 */
import { useEffect, useState } from 'react';
import { Bell, Send, Mail, MessageSquare, Phone, Webhook, Activity, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber } from '../components/primitives';

interface AlertHealthResp {
  channels: { channel: string; sent1h: number; sent24h: number; sent7d: number; lastFire: string | null }[];
  activeAlertsByMetric: { metric: string; count: number }[];
  subscriptions: { push: number; telegram: number };
  summary: { sent24h: number; sent7d: number };
}

function channelIcon(ch: string) {
  const lower = ch.toLowerCase();
  if (lower.startsWith('telegram')) return <Send style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('email'))    return <Mail style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('discord'))  return <MessageSquare style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('sms') || lower.includes('whatsapp')) return <Phone style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('webhook'))  return <Webhook style={{ width: 12, height: 12 }} />;
  if (lower.startsWith('push'))     return <Bell style={{ width: 12, height: 12 }} />;
  return <Bell style={{ width: 12, height: 12 }} />;
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

// "Fresh" if a channel has fired in the last 24h — used to color the
// row green; stale-but-not-cold (>24h, <7d) is amber; dead (>7d or
// never) is rose.
function freshnessTone(lastFire: string | null): string {
  if (!lastFire) return '#9ca3af';
  const ms = Date.now() - new Date(lastFire).getTime();
  if (ms < 86_400_000) return '#34d399'; // green
  if (ms < 7 * 86_400_000) return '#fcd34d'; // amber
  return '#f87171'; // rose
}

export function AlertsHealthTab() {
  const [data, setData] = useState<AlertHealthResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    setError(null);
    fetch('/api/admin/alert-health')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (d?.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message ?? 'Network error'))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <SectionHead
        title="Alert Engine"
        icon={<Bell style={{ width: 13, height: 13 }} />}
        right={
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            style={{ fontSize: 10, color: 'var(--fg-muted)', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw style={{ width: 11, height: 11, ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}) }} />
            refresh
          </button>
        }
      />

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#fda4af' }}>
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <KpiTile label="Sent · last 24h"     value={data ? fmtNumber(data.summary.sent24h) : null} accent="#fcd34d" />
        <KpiTile label="Sent · last 7d"      value={data ? fmtNumber(data.summary.sent7d) : null}  accent="#7dd3fc" />
        <KpiTile label="Push subscribers"    value={data ? fmtNumber(data.subscriptions.push) : null} accent="#34d399" />
        <KpiTile label="Telegram linked"     value={data ? fmtNumber(data.subscriptions.telegram) : null} accent="#c4b5fd" />
      </div>

      {/* Per-channel board */}
      <SectionHead title="Per-channel Send Velocity" icon={<Activity style={{ width: 13, height: 13 }} />} />
      <Card title="1h / 24h / 7d sends per channel · freshness color = last fire">
        {!data ? <SkeletonBlock h={120} /> : data.channels.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            No alert sends in any window yet.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                <th style={{ textAlign: 'left',  padding: '6px 0',  fontWeight: 700 }}>Channel</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>1h</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>24h</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>7d</th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>Last fire</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map(c => (
                <tr key={c.channel} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--fg-muted)' }}>{channelIcon(c.channel)}</span>
                    <span style={{ color: '#fff', textTransform: 'capitalize' }}>{c.channel}</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: freshnessTone(c.lastFire), marginLeft: 4 }} />
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>{fmtNumber(c.sent1h)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>{fmtNumber(c.sent24h)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>{fmtNumber(c.sent7d)}</td>
                  <td style={{ padding: '8px 0',  textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{fmtAgo(c.lastFire)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Active alerts by metric */}
      <SectionHead title="Active Alerts by Metric" icon={<AlertTriangle style={{ width: 13, height: 13 }} />} />
      <Card title="Top 10 metric subscriptions across all users">
        {!data ? <SkeletonBlock h={120} /> : data.activeAlertsByMetric.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            No active alerts configured yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {data.activeAlertsByMetric.map(m => {
              const max = Math.max(...data.activeAlertsByMetric.map(x => x.count), 1);
              const w = (m.count / max) * 100;
              return (
                <div key={m.metric} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-default)', fontFamily: 'var(--font-mono)' }}>{m.metric}</span>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${w}%`, height: '100%', background: '#fcd34d', transition: 'width 600ms ease-out' }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff' }}>{fmtNumber(m.count)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function KpiTile({ label, value, sub, accent }: { label: string; value: string | null; sub?: string | null; accent: string }) {
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
        {label}
      </div>
      {value === null ? <SkeletonBlock w={80} h={20} /> : (
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: accent }}>{value}</div>
      )}
      {sub && <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  );
}
