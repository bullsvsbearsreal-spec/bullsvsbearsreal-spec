'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Filter, BarChart3, ArrowRight, MousePointer, Activity, Users as UsersIcon } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber, fmtPct, TIER_COLORS } from '../components/primitives';
import type { StatsResp, FunnelStep, TopPage } from '../types';

/**
 * Growth tab — signups + retention + activation funnel + top pages.
 *
 * Funnel comes from /api/admin/funnel (new in this build). Stages:
 *   1. Total signups (anchor — 100%)
 *   2. Email verified
 *   3. Created first alert
 *   4. Connected first wallet OR key
 *
 * Top pages comes from /api/admin/top-pages — backed by the new
 * page_views table aggregated daily via the new
 * /api/cron/aggregate-page-views job. If the table is empty (first
 * day after migration), the section shows a "data collection ramping
 * up" placeholder.
 */
export function GrowthTab({ stats }: { stats: StatsResp | null }) {
  const [funnel, setFunnel] = useState<FunnelStep[] | null>(null);
  const [topPages, setTopPages] = useState<TopPage[] | null>(null);

  useEffect(() => {
    // Funnel + top-pages used to fetch once on mount and never refresh,
    // while the parent re-polled `stats` every 120s — so these two panels
    // silently went stale (and the header still said "updated HH:MM").
    // Poll them on the same cadence; keep last-known data on a transient
    // failure rather than blanking to [].
    const loadGrowth = () => {
      fetch('/api/admin/funnel')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setFunnel(Array.isArray(d.steps) ? d.steps : []); })
        .catch(() => setFunnel(prev => prev ?? []));
      fetch('/api/admin/top-pages?days=7&limit=10')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setTopPages(Array.isArray(d.pages) ? d.pages : []); })
        .catch(() => setTopPages(prev => prev ?? []));
    };
    loadGrowth();
    const id = setInterval(loadGrowth, 120_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {/* Signups + Tier Mix + Verified Mix */}
      <SectionHead title="User Growth & Composition" icon={<TrendingUp style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <Card title="New Signups">
          {!stats?.users?.signups ? (
            <SkeletonBlock w="100%" h={64} />
          ) : (
            <>
              <SignupRow label="Last 7 days"  value={stats.users.signups.last7d}  />
              <SignupRow label="Last 30 days" value={stats.users.signups.last30d} />
              <SignupRow label="Last 90 days" value={stats.users.signups.last90d} />
            </>
          )}
        </Card>
        <Card title="Tier Distribution">
          {!stats?.users?.tiers ? <SkeletonBlock w="100%" h={64} /> : (
            <TierMix tiers={stats.users.tiers} total={stats.totals.users} />
          )}
        </Card>
        <Card title="Email Verification">
          {!stats?.users?.verified ? <SkeletonBlock w="100%" h={64} /> : (
            <VerifiedMix v={stats.users.verified} />
          )}
        </Card>
      </div>

      {/* Engagement & Retention — DAU/WAU/MAU + Sean Ellis stickiness
          + cohort retention. Data was already on stats.users.active +
          stats.retention but had no UI surface. Ben asked for this
          metric specifically; surfacing it inline keeps the marketer
          flow on one page. */}
      <SectionHead title="Engagement & Retention" icon={<Activity style={{ width: 13, height: 13 }} />} />
      <div style={{ marginBottom: 18 }}>
        <Card title="Active users · stickiness · cohort retention">
          {!stats?.users?.active ? (
            <SkeletonBlock w="100%" h={100} />
          ) : (
            <EngagementBlock
              dau={stats.users.active.dau}
              wau={stats.users.active.wau}
              mau={stats.users.active.mau}
              retention={stats.retention}
            />
          )}
        </Card>
      </div>

      {/* Activation funnel */}
      <SectionHead title="Activation Funnel" icon={<Filter style={{ width: 13, height: 13 }} />} />
      <div style={{ marginBottom: 18 }}>
        <Card title="Visit → Signup → Verified → First Alert → First Wallet/Key">
          {!funnel ? <SkeletonBlock w="100%" h={120} /> : funnel.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
              Funnel data not available — signup-event tracking has been wired but the page-view counter is brand-new.
              The full funnel will show meaningful numbers once /api/track-page-view has 24h of data.
            </div>
          ) : (
            <FunnelChart steps={funnel} />
          )}
        </Card>
      </div>

      {/* Top pages */}
      <SectionHead title="Top Pages · last 7 days" icon={<BarChart3 style={{ width: 13, height: 13 }} />} />
      <div style={{ marginBottom: 18 }}>
        <Card title="Most-viewed routes">
          {!topPages ? <SkeletonBlock w="100%" h={160} /> : topPages.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '24px 0' }}>
              <MousePointer style={{ width: 16, height: 16, margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              Page-view counter is live but has no data yet.
              <br />
              First daily aggregation runs at 00:00 UTC; the table fills once /api/cron/aggregate-page-views has run at least once.
            </div>
          ) : (
            <TopPagesList pages={topPages} />
          )}
        </Card>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function SignupRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{fmtNumber(value)}</span>
    </div>
  );
}

function TierMix({ tiers, total }: { tiers: { tier: string; count: number }[]; total: number }) {
  const sorted = ['whale', 'pro', 'trader', 'free'].map(t => ({
    tier: t, count: tiers.find(x => x.tier === t)?.count ?? 0,
  }));
  return (
    <>
      <div style={{
        height: 10, borderRadius: 4, overflow: 'hidden', display: 'flex',
        background: 'rgba(255,255,255,0.04)', marginBottom: 12,
      }}>
        {sorted.map(({ tier, count }) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return pct > 0 ? (
            <div key={tier} style={{ width: `${pct}%`, height: '100%', background: TIER_COLORS[tier] }} />
          ) : null;
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sorted.map(({ tier, count }) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[tier] }} />
              <span style={{ flex: 1, color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{tier}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{count}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)', width: 50, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function VerifiedMix({ v }: { v: { verified: number; unverified: number } }) {
  const total = v.verified + v.unverified;
  const pct = total > 0 ? (v.verified / total) * 100 : 0;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--pump-mild)' }}>{pct.toFixed(0)}%</span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>verified</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--pump-mild)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
        <span>{v.verified} verified</span>
        <span>{v.unverified} pending</span>
      </div>
    </>
  );
}

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0) return null;
  const max = steps[0]?.count || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => {
        const widthPct = (s.count / max) * 100;
        return (
          <div key={s.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                {i + 1}. {s.label}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
                <span style={{ color: '#fff', fontWeight: 700 }}>{fmtNumber(s.count)}</span>
                <span style={{ color: i === 0 ? 'var(--fg-faint)' : 'var(--fg-muted)' }}>
                  {i === 0 ? '100%' : `${fmtPct(s.pctOfTop)} of top`}
                </span>
                {/* pctOfPrev only makes sense when this step is a strict
                    subset of the previous one. Our funnel steps are
                    independent dimensions (you can connect a wallet
                    without first creating an alert), so when a later
                    step has MORE users than the previous one, the
                    "drop-off %" reads as e.g. "→ 300%" which is
                    mathematically right but UX-confusing. Hide when
                    above 100% and explain via tooltip; show normally
                    when ≤100%. */}
                {i > 0 && s.pctOfPrev <= 100 && (
                  <span style={{ color: s.pctOfPrev > 70 ? 'var(--pump-mild)' : s.pctOfPrev > 40 ? '#fbbf24' : 'var(--rekt-mild)' }}>
                    → {fmtPct(s.pctOfPrev)}
                  </span>
                )}
                {i > 0 && s.pctOfPrev > 100 && (
                  <span
                    style={{ color: 'var(--fg-faint)', cursor: 'help' }}
                    title={`${fmtPct(s.pctOfPrev)} — this step isn't a strict subset of the previous one (users can complete it without first completing step ${i}), so a drop-off % isn't meaningful here.`}
                  >→ —</span>
                )}
              </span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${widthPct}%`, height: '100%',
                background: i === 0 ? 'var(--hub-accent)' : i === steps.length - 1 ? 'var(--pump-mild)' : 'rgba(125, 211, 252, 0.6)',
                transition: 'width 600ms ease-out',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Engagement & Retention — DAU/WAU/MAU + Sean Ellis stickiness +
// cohort retention. All data comes from the existing /api/admin/stats
// payload (users.active + retention) — no new endpoint needed; the
// numbers were just not being rendered anywhere.
// ────────────────────────────────────────────────────────────────────
type RetentionCell = { pct: number; total: number } | null | undefined;
function EngagementBlock({ dau, wau, mau, retention }: {
  dau: number;
  wau: number;
  mau: number;
  retention?: { d1: RetentionCell; d7: RetentionCell; d30: RetentionCell } | null;
}) {
  // Stickiness = DAU/WAU. Sean Ellis's product-engagement quality
  // metric — share of weekly actives who returned today.
  //   >30%  = exceptional
  //   20-30% = solid
  //   10-20% = typical for finance/crypto dashboards (users dip in
  //            once or twice a week to check, not daily traders)
  //   <10%  = at-risk, casual base
  const stickiness = wau > 0 ? Math.round((dau / wau) * 1000) / 10 : 0;
  const stickColor =
    stickiness >= 30 ? 'var(--pump-mild)' :
    stickiness >= 20 ? '#86efac' :
    stickiness >= 10 ? '#fcd34d' : 'var(--rekt-mild)';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: retention ? 16 : 0 }}>
        <ActiveTile label="DAU" sub="last 24h" value={fmtNumber(dau)} color="#7dd3fc" />
        <ActiveTile label="WAU" sub="last 7d"  value={fmtNumber(wau)} color="#c4b5fd" />
        <ActiveTile label="MAU" sub="last 30d" value={fmtNumber(mau)} color="#fdba74" />
        <ActiveTile
          label="Stickiness"
          sub="DAU ÷ WAU"
          value={`${stickiness}%`}
          color={stickColor}
          hint="Share of weekly actives who returned today (Sean Ellis stickiness). >25% is solid for B2B SaaS; 10-20% is typical for finance dashboards where users dip in once or twice a week. <10% indicates a mostly-casual base."
        />
      </div>

      {retention && (
        <>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)',
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <UsersIcon style={{ width: 10, height: 10 }} />
            Cohort retention · % of signups returning after N days
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <RetentionMini label="D1"  data={retention.d1}  good={40} ok={20}
                           hint="Of users signed up 1-30 days ago, the share that returned on/after day 1." />
            <RetentionMini label="D7"  data={retention.d7}  good={25} ok={10}
                           hint="Of users signed up 7-37 days ago, the share that returned on/after day 7." />
            <RetentionMini label="D30" data={retention.d30} good={15} ok={5}
                           hint="Of users signed up 30-60 days ago, the share that returned on/after day 30." />
          </div>
        </>
      )}
    </div>
  );
}

function ActiveTile({ label, sub, value, color, hint }: {
  label: string; sub: string; value: string; color: string; hint?: string;
}) {
  return (
    <div
      title={hint}
      style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
          {sub}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
    </div>
  );
}

function RetentionMini({ label, data, good, ok, hint }: {
  label: string;
  data: RetentionCell;
  good: number;
  ok: number;
  hint: string;
}) {
  const pct  = data?.pct ?? 0;
  const tot  = data?.total ?? 0;
  const hasData = tot > 0;
  const color =
    !hasData     ? 'var(--fg-faint)' :
    pct >= good  ? 'var(--pump-mild)' :
    pct >= ok    ? '#fcd34d' : 'var(--rekt-mild)';
  return (
    <div
      title={hasData ? `${hint}\n\nCohort size: ${tot} users` : `${hint}\n\nCohort window has no data yet (need 30+ days of signups for D30 to populate).`}
      style={{
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, transition: 'width 400ms ease-out' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right' }}>
        {hasData ? `${pct.toFixed(0)}%` : '—'}
      </span>
      <span style={{ fontSize: 9, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', minWidth: 38, textAlign: 'right' }}>
        n={fmtNumber(tot)}
      </span>
    </div>
  );
}

function TopPagesList({ pages }: { pages: TopPage[] }) {
  const max = Math.max(...pages.map(p => p.views), 1);
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
          <th style={{ textAlign: 'left',  padding: '6px 0', fontWeight: 700 }}>#</th>
          <th style={{ textAlign: 'left',  padding: '6px 8px', fontWeight: 700 }}>Route</th>
          <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>Views</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((p, i) => (
          <tr key={p.route} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <td style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)' }}>{i + 1}</td>
            <td style={{ padding: '8px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a href={p.route} target="_blank" rel="noopener noreferrer" style={{
                  color: '#fff', fontFamily: 'var(--font-mono)', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  {p.route}
                  <ArrowRight style={{ width: 10, height: 10, opacity: 0.4 }} />
                </a>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(p.views / max) * 100}%`, height: '100%', background: 'var(--hub-accent)' }} />
                </div>
              </div>
            </td>
            <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 700 }}>{fmtNumber(p.views)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
