'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Filter, BarChart3, ArrowRight, MousePointer } from 'lucide-react';
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
    fetch('/api/admin/funnel')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFunnel(Array.isArray(d.steps) ? d.steps : []); })
      .catch(() => setFunnel([]));
    fetch('/api/admin/top-pages?days=7&limit=10')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTopPages(Array.isArray(d.pages) ? d.pages : []); })
      .catch(() => setTopPages([]));
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
                {i > 0 && <span style={{ color: s.pctOfPrev > 70 ? 'var(--pump-mild)' : s.pctOfPrev > 40 ? '#fbbf24' : 'var(--rekt-mild)' }}>
                  → {fmtPct(s.pctOfPrev)}
                </span>}
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
