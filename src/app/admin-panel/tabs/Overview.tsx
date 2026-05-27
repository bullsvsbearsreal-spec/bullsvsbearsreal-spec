'use client';

import Link from 'next/link';
import { Users, Activity, Bell, Shield, Heart, BarChart3, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, Sparkline, fmtNumber, fmtPct, fmtAgo, TIER_COLORS } from '../components/primitives';
import type { StatsResp, AuditEntry } from '../types';

/**
 * Overview tab — "morning glance" view. Hero KPIs, retention cohort,
 * 7-day sparklines for the pipeline data stores, recent signups,
 * audit-log tail. Everything below the fold is on a dedicated tab.
 */
export function OverviewTab({ stats, audit, sysHealth }: {
  stats: StatsResp | null;
  audit: AuditEntry[];
  sysHealth: { label: string; detail: string; tone: string };
}) {
  return (
    <>
      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <KPI
          icon={<Users style={{ width: 16, height: 16 }} />}
          label="Total Users"
          value={stats ? fmtNumber(stats.totals.users) : null}
          sub={stats?.users?.signups ? `+${stats.users.signups.last30d} last 30d` : null}
          tint="hub-yellow"
        />
        <KPI
          icon={<Activity style={{ width: 16, height: 16 }} />}
          label="MAU · Monthly active"
          value={stats?.users?.active ? fmtNumber(stats.users.active.mau) : null}
          sub={stats?.users?.active ? `${fmtNumber(stats.users.active.wau)} WAU · ${fmtNumber(stats.users.active.dau)} DAU` : null}
          tint="emerald"
        />
        <KPI
          icon={<Bell style={{ width: 16, height: 16 }} />}
          label="Alerts fired 24h"
          value={stats ? fmtNumber(stats.last24h.alertNotifications) : null}
          sub={stats?.notifications && stats.notifications.total > 0
            ? `${fmtPct((stats.notifications.sent / stats.notifications.total) * 100)} success · 7d`
            : 'No 7d data'}
          tint="cyan"
        />
        <KPI
          icon={<Shield style={{ width: 16, height: 16 }} />}
          label="System health"
          value={sysHealth.label}
          sub={sysHealth.detail}
          tint={sysHealth.tone}
        />
      </div>

      {/* Retention */}
      <SectionHead title="Retention Cohorts" icon={<Heart style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {(['d1', 'd7', 'd30'] as const).map(k => {
          const data = stats?.retention?.[k];
          return (
            <div key={k} style={{
              background: 'var(--hub-darker)',
              border: '1px solid var(--hub-border-subtle)',
              borderRadius: 10, padding: 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>
                {k.toUpperCase()} retention
              </div>
              {data === undefined ? <SkeletonBlock w={80} h={32} /> :
               data === null ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>—</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>No cohort yet</div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-mono)',
                    color: data.pct >= 40 ? 'var(--pump-mild)' : data.pct >= 20 ? '#fbbf24' : 'var(--rekt-mild)',
                  }}>
                    {data.pct.toFixed(0)}<span style={{ fontSize: 18, marginLeft: 2 }}>%</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    n={data.total}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 7-day activity sparklines */}
      <SectionHead title="Activity Volume · last 7 days" icon={<BarChart3 style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <SparkTile label="Alerts"            value={stats?.totals.alertNotifications}      trend={stats?.trends?.alerts}      color="#f59e0b" />
        <SparkTile label="Funding snaps"     value={stats?.totals.fundingSnapshots}        trend={stats?.trends?.funding}     color="#22c55e" />
        <SparkTile label="OI snaps"          value={stats?.totals.oiSnapshots}             trend={stats?.trends?.oi}          color="#3b82f6" />
        <SparkTile label="Liquidation snaps" value={stats?.totals.liquidationSnapshots}    trend={stats?.trends?.liquidations} color="#ef4444" />
      </div>

      {/* Recent signups + audit log side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Recent Signups">
          {!stats?.users?.recent ? (
            <SkeletonBlock w="100%" h={120} />
          ) : stats.users.recent.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>No signups yet.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 700 }}>User</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>Tier</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.users.recent.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ color: '#fff', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name || (r.email ? r.email.split('@')[0] : '(no name)')}
                      </div>
                      {r.email && (
                        <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 7px', borderRadius: 999,
                        background: `${TIER_COLORS[r.tier] ?? TIER_COLORS.free}22`,
                        color: TIER_COLORS[r.tier] ?? TIER_COLORS.free,
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{r.tier}</span>
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{fmtAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Audit Log · last 10" action={
          <Link href="#ops" style={{ fontSize: 10, color: 'var(--hub-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            Full log <ArrowRight style={{ width: 11, height: 11 }} />
          </Link>
        }>
          {audit.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>No recent admin actions.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 700 }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>Actor</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>When</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fcd34d' }}>{r.action}</td>
                    <td style={{ padding: '8px 8px', color: 'var(--fg-default)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.actorName || r.actorEmail || '—'}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{fmtAgo(r.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components for Overview
// ────────────────────────────────────────────────────────────────────
const TINTS: Record<string, { bg: string; border: string; text: string }> = {
  'hub-yellow': { bg: 'rgba(251, 191, 36, 0.06)', border: 'rgba(251, 191, 36, 0.2)',  text: '#fbbf24' },
  emerald:      { bg: 'rgba(52, 211, 153, 0.06)', border: 'rgba(52, 211, 153, 0.2)',   text: '#34d399' },
  cyan:         { bg: 'rgba(125, 211, 252, 0.06)', border: 'rgba(125, 211, 252, 0.2)', text: '#7dd3fc' },
  rose:         { bg: 'rgba(244, 114, 182, 0.06)', border: 'rgba(244, 114, 182, 0.2)', text: '#f472b6' },
  amber:        { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.2)',   text: '#f59e0b' },
};

function KPI({ icon, label, value, sub, tint }: { icon: React.ReactNode; label: string; value: string | null; sub?: string | null; tint: string }) {
  const t = TINTS[tint] ?? TINTS['hub-yellow'];
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: `1px solid ${t.border}`,
      borderRadius: 12, padding: '14px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${t.bg}, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ color: t.text }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>{label}</span>
        </div>
        {value === null ? <SkeletonBlock w={80} h={28} /> : (
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{value}</div>
        )}
        {sub && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function SparkTile({ label, value, trend, color }: { label: string; value?: number; trend?: number[]; color: string }) {
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
          {value === undefined ? <SkeletonBlock w={60} h={20} /> : fmtNumber(value)}
        </div>
        <Sparkline data={trend} color={color} />
      </div>
    </div>
  );
}
