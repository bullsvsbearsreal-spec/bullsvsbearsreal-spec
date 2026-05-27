'use client';

/**
 * API analytics tab — public-API consumption + rate-limit health.
 *
 * Sources: api_keys (issued keys + requests_today) + rate_limit_events
 * (last 24h of 429s).
 */
import { useEffect, useState } from 'react';
import { Key, AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber, TIER_COLORS } from '../components/primitives';

interface ApiAnalyticsResp {
  totals: {
    totalKeys: number;
    requestsToday: number;
    activeKeys24h: number;
    activeKeys7d: number;
    neverUsedKeys: number;
  };
  keysByTier: { tier: string; count: number }[];
  topConsumers: {
    id: string;
    name: string;
    tier: string;
    requestsToday: number;
    lastUsedAt: string | null;
    email: string | null;
  }[];
  rateLimits: {
    hits24h: number;
    byLimiter: { limiter: string; count: number }[];
  };
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

export function ApiAnalyticsTab() {
  const [data, setData] = useState<ApiAnalyticsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    setError(null);
    fetch('/api/admin/api-analytics')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (d?.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message ?? 'Network error'))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <SectionHead
        title="Public API Health"
        icon={<Key style={{ width: 13, height: 13 }} />}
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
        <KpiTile label="Active keys"        value={data ? fmtNumber(data.totals.totalKeys)     : null} accent="#fcd34d"
                 sub={data ? `${data.totals.neverUsedKeys} never used` : null} />
        <KpiTile label="Requests today"     value={data ? fmtNumber(data.totals.requestsToday) : null} accent="#34d399" />
        <KpiTile label="Used · last 24h"    value={data ? fmtNumber(data.totals.activeKeys24h) : null} accent="#7dd3fc"
                 sub={data ? `${fmtNumber(data.totals.activeKeys7d)} in 7d` : null} />
        <KpiTile
          label="Rate-limit hits 24h"
          value={data ? fmtNumber(data.rateLimits.hits24h) : null}
          accent={data && data.rateLimits.hits24h > 100 ? '#f43f5e' : '#9ca3af'}
        />
      </div>

      {/* Keys by tier */}
      <SectionHead title="Keys by Tier" icon={<Activity style={{ width: 13, height: 13 }} />} />
      <Card title="Distribution across plan tiers">
        {!data ? <SkeletonBlock h={80} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {data.keysByTier.map(t => (
              <div key={t.tier} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--hub-border-subtle)',
                borderRadius: 8, padding: '10px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TIER_COLORS[t.tier] ?? 'var(--fg-muted)' }}>
                  {t.tier}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff', marginTop: 4 }}>{t.count}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top consumers */}
      <SectionHead title="Top API Consumers · today" icon={<Activity style={{ width: 13, height: 13 }} />} />
      <Card title="Top 10 keys ranked by requests today">
        {!data ? <SkeletonBlock h={120} /> : data.topConsumers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            No API requests today yet.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 700 }}>Key</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>Tier</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Reqs today</th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>Last used</th>
              </tr>
            </thead>
            <tbody>
              {data.topConsumers.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px 0' }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{c.name}</div>
                    {c.email && <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{c.email}</div>}
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 999,
                      background: `${TIER_COLORS[c.tier] ?? TIER_COLORS.free}22`,
                      color: TIER_COLORS[c.tier] ?? TIER_COLORS.free,
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{c.tier}</span>
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{fmtNumber(c.requestsToday)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{fmtAgo(c.lastUsedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Rate limit breakdown */}
      <SectionHead title="Rate-Limit Hits by Limiter · 24h" icon={<AlertTriangle style={{ width: 13, height: 13 }} />} />
      <Card title="429s issued per rate-limit policy">
        {!data ? <SkeletonBlock h={80} /> : data.rateLimits.byLimiter.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            No rate-limit hits in the last 24 hours.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {data.rateLimits.byLimiter.map(l => {
              const max = Math.max(...data.rateLimits.byLimiter.map(x => x.count), 1);
              const w = (l.count / max) * 100;
              return (
                <div key={l.limiter} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-default)', fontFamily: 'var(--font-mono)' }}>{l.limiter}</span>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${w}%`, height: '100%', background: '#f43f5e', transition: 'width 600ms ease-out' }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff' }}>{fmtNumber(l.count)}</span>
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
