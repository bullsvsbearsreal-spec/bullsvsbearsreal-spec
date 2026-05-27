'use client';

/**
 * Acquisition tab — marketing-panel surface for first-touch attribution.
 *
 * Pulls /api/marketing/acquisition which aggregates users.acq_* columns
 * captured at signup via the ih_acq cookie set by middleware on landing.
 *
 * Three breakdowns side-by-side:
 *   · By utm_source    (where the traffic came from)
 *   · By utm_campaign  (which campaign drove signups)
 *   · By referer host  (organic / external sites linking to us)
 *
 * Each row shows signups + paid conversions + conversion %.
 */

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber } from '../components/primitives';

type Window = 'all' | '30d' | '7d';

interface SourceRow { source: string; signups: number; paid: number }
interface AcquisitionResp {
  window: Window;
  totals: { signups: number; paid: number };
  bySource:   SourceRow[];
  byCampaign: SourceRow[];
  byReferer:  SourceRow[];
}

export function AcquisitionTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [data, setData] = useState<AcquisitionResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [window, setWindow] = useState<Window>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/marketing/acquisition?window=${window}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load acquisition data', false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [window, onToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionHead
        title="First-touch acquisition"
        icon={<TrendingUp style={{ width: 13, height: 13 }} />}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', '30d', '7d'] as Window[]).map(w => {
                const active = window === w;
                return (
                  <button
                    key={w}
                    onClick={() => setWindow(w)}
                    style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                      background: active ? 'rgba(196, 181, 253, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(196, 181, 253, 0.4)' : 'var(--hub-border-subtle)'}`,
                      color: active ? '#c4b5fd' : 'var(--fg-muted)',
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}
                  >{w === 'all' ? 'all-time' : w}</button>
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

      {data && (
        <Card title="Attribution coverage">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: 11, color: 'var(--fg-muted)' }}>
            <span>
              <strong style={{ color: '#fff', fontSize: 14, fontFamily: 'var(--font-mono)' }}>{fmtNumber(data.totals.signups)}</strong> signups in window
            </span>
            <span>
              · <strong style={{ color: '#86efac', fontSize: 14, fontFamily: 'var(--font-mono)' }}>{fmtNumber(data.totals.paid)}</strong> paid
              ({data.totals.signups > 0 ? Math.round((data.totals.paid / data.totals.signups) * 1000) / 10 : 0}%)
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-faint)' }}>
              Only signups whose ih_acq cookie was set on landing are attributed. Direct/cookie-less signups show as &quot;organic&quot;.
            </span>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
        {loading ? (
          <>
            <SkeletonBlock w="100%" h={200} />
            <SkeletonBlock w="100%" h={200} />
            <SkeletonBlock w="100%" h={200} />
          </>
        ) : (
          <>
            <SourceTable title="By utm_source"   rows={data?.bySource   ?? []} total={data?.totals.signups ?? 0} />
            <SourceTable title="By utm_campaign" rows={data?.byCampaign ?? []} total={data?.totals.signups ?? 0} />
            <SourceTable title="By referer host" rows={data?.byReferer  ?? []} total={data?.totals.signups ?? 0} isUrl />
          </>
        )}
      </div>
    </>
  );
}

function SourceTable({ title, rows, total, isUrl }: { title: string; rows: SourceRow[]; total: number; isUrl?: boolean }) {
  const top = rows.slice(0, 12);
  const maxSignups = top.reduce((m, r) => Math.max(m, r.signups), 0) || 1;
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10, padding: 12, minHeight: 220,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        {title}
      </div>
      {top.length === 0 ? (
        <div style={{ color: 'var(--fg-faint)', fontSize: 11, padding: '20px 0', textAlign: 'center' }}>
          No data yet for this window.
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {top.map(r => {
            const pct = total > 0 ? (r.signups / total) * 100 : 0;
            const barPct = (r.signups / maxSignups) * 100;
            return (
              <li key={r.source} style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(196, 181, 253, 0.06)',
                  width: `${barPct}%`, borderRadius: 4, pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
                  <span style={{ fontSize: 11, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isUrl && <ExternalLink style={{ width: 9, height: 9, color: 'var(--fg-muted)', flexShrink: 0 }} />}
                    {r.source}
                  </span>
                  <span style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {fmtNumber(r.signups)}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'right' }}>
                    {pct < 1 ? '<1%' : `${Math.round(pct)}%`}
                  </span>
                  {r.paid > 0 && (
                    <span style={{ fontSize: 9, color: '#86efac', fontFamily: 'var(--font-mono)', minWidth: 26, textAlign: 'right' }}>
                      ${r.paid}p
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
