'use client';

/**
 * ApiUsage tab — admin observation of /api/v1 traffic.
 *
 * Pulls /api/admin/api-usage which aggregates api_request_log (sampled
 * 1-in-5 in v1-auth, so summary numbers carry a "≈" prefix). Surfaces:
 *
 *   · Top stats (total req, unique users, error %, p50/p95 latency)
 *   · Top endpoints (table: endpoint, hits, error %, p50)
 *   · Top users (table: email, tier, hits, error %, last hit)
 *
 * Window toggle: 24h / 7d / 30d.
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber, fmtAgo } from '../components/primitives';

type Window = '24h' | '7d' | '30d';

interface Summary {
  total_requests: number;
  unique_users: number;
  errors: number;
  p50_ms: number | null;
  p95_ms: number | null;
}

interface EndpointRow { endpoint: string; hits: number; errors: number; errorPct: number; p50Ms: number | null }
interface UserRow { userId: string; email: string | null; billingTier: string | null; hits: number; errors: number; errorPct: number; lastHit: string | null }

interface UsageResp {
  window: Window;
  sampled: boolean;
  sampleRate: number;
  summary: Summary | null;
  topEndpoints: EndpointRow[];
  topUsers: UserRow[];
}

export function ApiUsageTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [data, setData] = useState<UsageResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [window, setWindow] = useState<Window>('24h');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/api-usage?window=${window}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load API usage', false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [window, onToast]);

  useEffect(() => { load(); }, [load]);

  const scaleHint = data?.sampled ? '~' : '';
  const scale = (n: number) => Math.round(n / (data?.sampleRate ?? 0.2));

  return (
    <>
      <SectionHead
        title="API usage · /api/v1"
        icon={<Activity style={{ width: 13, height: 13 }} />}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['24h', '7d', '30d'] as Window[]).map(w => {
                const active = window === w;
                return (
                  <button
                    key={w}
                    onClick={() => setWindow(w)}
                    style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                      background: active ? 'rgba(125, 211, 252, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(125, 211, 252, 0.4)' : 'var(--hub-border-subtle)'}`,
                      color: active ? '#7dd3fc' : 'var(--fg-muted)',
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}
                  >{w}</button>
                );
              })}
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ background: 'transparent', border: 0, color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        }
      />

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        {loading || !data?.summary ? (
          <>
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
          </>
        ) : (
          <>
            <Tile label="Total requests" value={`${scaleHint}${fmtNumber(scale(data.summary.total_requests || 0))}`} sub={data.sampled ? `${fmtNumber(data.summary.total_requests || 0)} sampled` : null} color="#7dd3fc" />
            <Tile label="Unique users" value={fmtNumber(data.summary.unique_users || 0)} color="#c4b5fd" />
            <Tile
              label="Error rate"
              value={data.summary.total_requests > 0
                ? `${Math.round((data.summary.errors / data.summary.total_requests) * 1000) / 10}%`
                : '0%'}
              sub={`${fmtNumber(data.summary.errors || 0)} errors`}
              color={data.summary.errors / Math.max(1, data.summary.total_requests) > 0.05 ? '#f87171' : '#86efac'}
            />
            <Tile
              label="Latency p50 / p95"
              value={`${data.summary.p50_ms ?? '—'} / ${data.summary.p95_ms ?? '—'} ms`}
              color="#fcd34d"
            />
          </>
        )}
      </div>

      {/* Side-by-side tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Top endpoints">
          {loading ? (
            <SkeletonBlock w="100%" h={160} />
          ) : !data || data.topEndpoints.length === 0 ? (
            <div style={{ color: 'var(--fg-faint)', fontSize: 11, padding: '8px 0' }}>No traffic in this window.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 9, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Endpoint</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Hits</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Err %</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>p50</th>
                </tr>
              </thead>
              <tbody>
                {data.topEndpoints.map(r => (
                  <tr key={r.endpoint} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '5px 6px', fontFamily: 'var(--font-mono)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                      {r.endpoint}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      {fmtNumber(r.hits)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.errorPct > 5 ? '#f87171' : 'var(--fg-muted)' }}>
                      {r.errorPct}%
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                      {r.p50Ms ?? '—'}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Top API consumers">
          {loading ? (
            <SkeletonBlock w="100%" h={160} />
          ) : !data || data.topUsers.length === 0 ? (
            <div style={{ color: 'var(--fg-faint)', fontSize: 11, padding: '8px 0' }}>No consumers in this window.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 9, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>User</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Hits</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Err %</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Last hit</th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map(r => (
                  <tr key={r.userId} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '5px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                      <span style={{ color: '#fff' }}>{r.email || r.userId.slice(0, 8)}</span>
                      {r.billingTier && r.billingTier !== 'free' && (
                        <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {r.billingTier}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      {fmtNumber(r.hits)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.errorPct > 5 ? '#f87171' : 'var(--fg-muted)' }}>
                      {r.errorPct}%
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                      {r.lastHit ? fmtAgo(r.lastHit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--fg-faint)' }}>
        Requests are sampled 1-in-5 at the auth layer to keep the log table small.
        Hit counts shown are the sampled values; total-requests tile is multiplied 5× for an estimate.
      </div>
    </>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string | null; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}
