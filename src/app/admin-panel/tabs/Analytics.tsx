'use client';

/**
 * Analytics tab — native UI on top of self-hosted Umami.
 *
 * Mounted in /admin-panel and /marketing-panel. Pulls /api/admin/analytics
 * which proxies to the Umami REST API server-side (so the API token
 * never touches the browser). Auto-refreshes every 60s.
 *
 * Sections:
 *   - Active right now (live counter)
 *   - 5-tile summary strip (pageviews, visitors, visits, bounce%, avg dur)
 *   - Time-series bars (pageviews + unique visitors over the window)
 *   - Top pages · Top referrers · Top countries (side-by-side tables)
 *
 * When Umami isn't configured yet (env vars unset), the endpoint
 * returns `configured: false` and we paint a friendly setup-required
 * empty state with a link to the operator notes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, RefreshCw, ExternalLink, Globe, MapPin } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber } from '../components/primitives';

type Window = '24h' | '7d' | '30d';

interface MetricRow { count: number }
interface PageRow extends MetricRow { url: string }
interface RefRow extends MetricRow { referrer: string }
interface GeoRow extends MetricRow { country: string }
interface TsRow { ts: string; pageviews: number; visitors: number }

interface AnalyticsResp {
  configured: boolean;
  window: Window;
  activeNow: number;
  stats: { pageviews: number; visitors: number; visits: number; bouncesPct: number; avgVisitSec: number };
  timeseries: TsRow[];
  topPages: PageRow[];
  topReferrers: RefRow[];
  topCountries: GeoRow[];
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '0s';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function AnalyticsTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [window, setWindow] = useState<Window>('7d');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/analytics?window=${window}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to load analytics', false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [window, onToast]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s. The active-visitors counter wants to feel
  // live; the rest is fine on the same cadence.
  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const maxPv = useMemo(() => {
    if (!data?.timeseries.length) return 1;
    return Math.max(1, ...data.timeseries.map(t => t.pageviews));
  }, [data]);

  // Setup-required state
  if (data && !data.configured) {
    return (
      <>
        <SectionHead title="Site analytics" icon={<Activity style={{ width: 13, height: 13 }} />} />
        <Card title="Umami not configured yet">
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            This tab pulls data from a self-hosted Umami instance on the aggregator droplet.
            Until it&apos;s deployed, no traffic numbers will appear here.
            <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              Set <code>UMAMI_HOST</code>, <code>UMAMI_API_TOKEN</code>, <code>UMAMI_WEBSITE_ID</code>,
              and the public <code>NEXT_PUBLIC_UMAMI_HOST</code> + <code>NEXT_PUBLIC_UMAMI_WEBSITE_ID</code>
              env vars on DO App Platform. The tracker script in <code>app/layout.tsx</code> auto-loads once
              the public vars are set; the API proxy fans out to Umami once the server-side ones are set.
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionHead
        title="Site analytics"
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

      {/* Live-active counter — punchy header tile */}
      {data && data.activeNow > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', marginBottom: 12,
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 999,
          fontSize: 11, color: '#86efac', fontWeight: 600,
        }}>
          <span className="pulse-success" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.7)' }} />
          {data.activeNow} active right now
        </div>
      )}

      {/* Headline tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
        {loading || !data ? (
          <>
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
            <SkeletonBlock w="100%" h={70} />
          </>
        ) : (
          <>
            <Tile label="Pageviews"  value={fmtNumber(data.stats.pageviews)} color="#7dd3fc" />
            <Tile label="Visitors"   value={fmtNumber(data.stats.visitors)}  color="#c4b5fd" />
            <Tile label="Visits"     value={fmtNumber(data.stats.visits)}    color="#fcd34d" />
            <Tile
              label="Bounce rate"
              value={`${data.stats.bouncesPct}%`}
              color={data.stats.bouncesPct > 60 ? '#f87171' : data.stats.bouncesPct > 40 ? '#fcd34d' : '#86efac'}
            />
            <Tile label="Avg visit"  value={fmtDuration(data.stats.avgVisitSec)} color="#fdba74" />
          </>
        )}
      </div>

      {/* Time-series — pageview bars */}
      <Card title={`Pageviews · last ${window === '24h' ? '24h' : window === '30d' ? '30d' : '7d'}`}>
        {loading || !data ? (
          <SkeletonBlock w="100%" h={120} />
        ) : data.timeseries.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>
            No traffic recorded in this window yet.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, padding: '0 4px' }}>
            {data.timeseries.map(t => {
              const h = (t.pageviews / maxPv) * 100;
              return (
                <div
                  key={t.ts}
                  title={`${t.ts}\n${t.pageviews} pageviews · ${t.visitors} visitors`}
                  style={{
                    flex: 1,
                    height: `${Math.max(2, h)}%`,
                    background: 'linear-gradient(180deg, rgba(125, 211, 252, 0.75) 0%, rgba(125, 211, 252, 0.3) 100%)',
                    borderRadius: '2px 2px 0 0',
                    minWidth: 4,
                    transition: 'height 200ms',
                  }}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* 3-up tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
        <MetricList
          title="Top pages"
          icon={<ExternalLink style={{ width: 11, height: 11 }} />}
          rows={data?.topPages.map(p => ({ key: p.url, label: p.url, count: p.count })) ?? []}
          loading={loading}
          mono
        />
        <MetricList
          title="Top referrers"
          icon={<Globe style={{ width: 11, height: 11 }} />}
          rows={data?.topReferrers.map(r => ({ key: r.referrer, label: r.referrer, count: r.count })) ?? []}
          loading={loading}
          emptyText="No external referrers yet — most traffic is direct or untracked."
        />
        <MetricList
          title="Top countries"
          icon={<MapPin style={{ width: 11, height: 11 }} />}
          rows={data?.topCountries.map(c => ({ key: c.country, label: c.country || '(unknown)', count: c.count })) ?? []}
          loading={loading}
        />
      </div>
    </>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
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
    </div>
  );
}

interface MetricListItem { key: string; label: string; count: number }
function MetricList({ title, icon, rows, loading, mono, emptyText }: {
  title: string;
  icon: React.ReactNode;
  rows: MetricListItem[];
  loading: boolean;
  mono?: boolean;
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10, padding: 12, minHeight: 220,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        {icon} {title}
      </div>
      {loading ? (
        <SkeletonBlock w="100%" h={160} />
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '20px 4px', textAlign: 'center', lineHeight: 1.5 }}>
          {emptyText || 'No data yet for this window.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(r => {
            const barPct = (r.count / max) * 100;
            return (
              <li key={r.key} style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(125, 211, 252, 0.06)',
                  width: `${barPct}%`, borderRadius: 4, pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
                  <span style={{
                    fontSize: 11, color: '#fff', flex: 1,
                    fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {r.count}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
