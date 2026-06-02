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
 *   - Time-series bars (pageviews) with 3-tick x-axis labels
 *   - Top pages · Top referrers · Top countries (side-by-side tables)
 *   - "Open Umami ↗" deep-link for drilling into specific pages/dates
 *
 * When Umami isn't configured yet (env vars unset), the endpoint
 * returns `configured: false` and we paint a friendly setup-required
 * empty state with a link to the operator notes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, RefreshCw, ExternalLink, Globe, MapPin } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber } from '../components/primitives';

// Period — NOT named `Window` because that would shadow the DOM
// `Window` interface inside this file. Same reason the state below is
// `period`, not `window`: a `const window = '7d'` masks the global
// `window` object inside this component and breaks anyone who later
// tries `window.localStorage.X` or `window.open(...)` without noticing.
type Period = '24h' | '7d' | '30d';

interface MetricRow { count: number }
interface PageRow extends MetricRow { url: string }
interface RefRow extends MetricRow { referrer: string }
interface GeoRow extends MetricRow { country: string }
interface TsRow { ts: string; pageviews: number; visitors: number }

interface AnalyticsResp {
  configured: boolean;
  window: Period;   // API response still uses the key `window` — kept stable
  activeNow: number;
  stats: { pageviews: number; visitors: number; visits: number; bouncesPct: number; avgVisitSec: number };
  timeseries: TsRow[];
  topPages: PageRow[];
  topReferrers: RefRow[];
  topCountries: GeoRow[];
  stickiness?: { dau: number; wau: number; ratioPct: number };
}

// Public Umami host — used for the "Open Umami ↗" deep-link in the
// section head and setup-required state. Falls back to nothing if env
// not set, in which case we just omit the link rather than render a
// broken anchor.
const UMAMI_PUBLIC_HOST = process.env.NEXT_PUBLIC_UMAMI_HOST || '';

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '0s';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// Compact x-axis tick label for the time-series bars. Umami buckets
// arrive as 'YYYY-MM-DD HH:MM:SS' strings (UTC). Format depends on
// window length so 30 abbreviated day names don't squeeze together:
//   24h → "14:00"
//    7d → "Mon"
//   30d → "12 May"
function fmtTick(ts: string, period: Period): string {
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return ts.slice(5, 10);
  if (period === '24h') return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
  if (period === '7d')  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${d.getUTCDate()} ${d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}`;
}

export function AnalyticsTab({ onToast }: { onToast: (msg: string, ok: boolean) => void }) {
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('7d');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?window=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load analytics';
      setError(msg);
      onToast(msg, false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [period, onToast]);

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

  // 3 evenly-spaced x-axis ticks: start, middle, end. Cheap visual
  // anchor so users can read "Mon · Wed · Fri" without having to
  // hover every bar to see the date. All bars still render with a
  // hover-tooltip; this just labels three of them inline.
  const tickIndices = useMemo(() => {
    if (!data || data.timeseries.length < 2) return new Set<number>();
    const last = data.timeseries.length - 1;
    return new Set([0, Math.floor(last / 2), last]);
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
            {UMAMI_PUBLIC_HOST && (
              <div style={{ marginTop: 12 }}>
                <a
                  href={UMAMI_PUBLIC_HOST}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7dd3fc', textDecoration: 'none' }}
                >
                  Open Umami admin <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              </div>
            )}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {error && !data && (
        <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--rekt-mild)', fontSize: 12 }}>
          Couldn&apos;t load analytics · {error}
        </div>
      )}
      <SectionHead
        title="Site analytics"
        icon={<Activity style={{ width: 13, height: 13 }} />}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['24h', '7d', '30d'] as Period[]).map(p => {
                const active = period === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                      background: active ? 'rgba(125, 211, 252, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(125, 211, 252, 0.4)' : 'var(--hub-border-subtle)'}`,
                      color: active ? '#7dd3fc' : 'var(--fg-muted)',
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}
                  >{p}</button>
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
            {UMAMI_PUBLIC_HOST && (
              <a
                href={UMAMI_PUBLIC_HOST}
                target="_blank"
                rel="noopener noreferrer"
                title="Drill into the full Umami dashboard"
                style={{ background: 'transparent', color: 'var(--fg-muted)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
              >
                <ExternalLink style={{ width: 12, height: 12 }} /> Umami
              </a>
            )}
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
            <Tile
              label="Visitors"
              value={fmtNumber(data.stats.visitors)}
              color="#c4b5fd"
              hint="All browsers, signed-in or anonymous"
            />
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

      {/* Stickiness · DAU/WAU — period-independent (always today-over-this-week).
          The activation signal: of this week's unique visitors, how many also
          showed up today. <30% occasional · 30-50% recurring · 50%+ daily habit. */}
      {data?.stickiness && (() => {
        const s = data.stickiness;
        const noData = s.wau === 0;
        const color = noData ? 'var(--fg-muted)' : s.ratioPct >= 50 ? '#86efac' : s.ratioPct >= 30 ? '#fcd34d' : '#f87171';
        const note = noData ? 'no visitors yet this week'
          : s.ratioPct >= 50 ? 'daily-habit territory'
          : s.ratioPct >= 30 ? 'returning every few days'
          : 'mostly occasional reference';
        return (
          <div
            title="DAU/WAU = unique visitors in the last 24h ÷ unique visitors in the last 7d. Higher = more of your weekly audience treats InfoHub as a daily workflow."
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10,
              padding: '10px 14px', marginBottom: 12,
              background: 'var(--hub-darker)', border: '1px solid var(--hub-border-subtle)', borderRadius: 10,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Stickiness · DAU/WAU
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
              {noData ? '—' : `${s.ratioPct}%`}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
              {fmtNumber(s.dau)} today · {fmtNumber(s.wau)} this week
            </span>
            <span style={{ fontSize: 11, color }}>{note}</span>
          </div>
        );
      })()}

      {/* Time-series — pageview bars + 3-tick x-axis */}
      <Card title={`Pageviews · last ${period}`}>
        {loading || !data ? (
          <SkeletonBlock w="100%" h={120} />
        ) : data.timeseries.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>
            No traffic recorded in this window yet.
          </div>
        ) : (
          <>
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
            {/* 3-tick x-axis — start / middle / end. All ticks render
                in the flex row so spacing matches the bars exactly,
                but only the 3 anchor ticks are visible. */}
            <div style={{ display: 'flex', padding: '4px 4px 0', fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
              {data.timeseries.map((t, i) => (
                <span
                  key={t.ts}
                  style={{
                    visibility: tickIndices.has(i) ? 'visible' : 'hidden',
                    flex: 1,
                    textAlign: i === 0 ? 'left' : i === data.timeseries.length - 1 ? 'right' : 'center',
                  }}
                >
                  {fmtTick(t.ts, period)}
                </span>
              ))}
            </div>
          </>
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

function Tile({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div
      title={hint}
      style={{
        padding: '12px 14px',
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 10,
      }}
    >
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
                  <span
                    title={r.label}
                    style={{
                      fontSize: 11, color: '#fff', flex: 1,
                      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
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
