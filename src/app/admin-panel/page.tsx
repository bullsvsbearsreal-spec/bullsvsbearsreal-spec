'use client';

/**
 * /admin-panel — tabbed operator dashboard.
 *
 * Six tabs (hash-routed so a refresh keeps you where you were):
 *   #overview      · KPIs + retention + activity sparklines + recents
 *   #users         · Searchable user table + drawer + CSV
 *   #growth        · Signups + tier mix + activation funnel + top pages
 *   #notifications · Delivery success + per-channel volume
 *   #ops           · Cron triggers + cache flush + aggregator board + audit log
 *   #feedback      · Bug reports inbox
 *
 * Advisor role sees a stripped subset (Overview + Growth only) — every
 * mutating tab is hidden, not just disabled, so the surface area for
 * accidental writes is zero.
 *
 * Polling: a single 2-minute interval refreshes /api/admin/stats and
 * /api/admin/audit-log behind the scenes. Per-tab data (users list,
 * aggregator health, feedback inbox) is owned by the tab and refreshes
 * on its own cadence.
 *
 * Red banner: surfaces hot conditions (high-severity open bug reports,
 * degraded notification delivery, suspended notification queue) at the
 * top of every tab so the operator never misses a fire.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Shield, Users, BarChart3, Bell, Cog, Bug, RefreshCw, Lock,
  DollarSign, Key, Activity,
} from 'lucide-react';
import { OverviewTab }      from './tabs/Overview';
import { UsersTab }         from './tabs/Users';
import { GrowthTab }        from './tabs/Growth';
import { NotificationsTab } from './tabs/Notifications';
import { OpsTab }           from './tabs/Ops';
import { FeedbackTab }      from './tabs/Feedback';
import { RevenueTab }       from './tabs/Revenue';
import { ApiAnalyticsTab }  from './tabs/ApiAnalytics';
import { AlertsHealthTab }  from './tabs/AlertsHealth';
import { RedBanner, ToastHost, type ToastMsg, fmtNumber } from './components/primitives';
import type { StatsResp, AuditEntry, BugReport } from './types';

// ────────────────────────────────────────────────────────────────────
// Tab definitions
// ────────────────────────────────────────────────────────────────────
type TabId =
  | 'overview' | 'users' | 'growth' | 'revenue' | 'api'
  | 'notifications' | 'alerts' | 'ops' | 'feedback';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  advisor: boolean;   // visible in advisor mode?
}

const ALL_TABS: TabDef[] = [
  { id: 'overview',      label: 'Overview',      icon: <Shield     style={{ width: 13, height: 13 }} />, advisor: true  },
  { id: 'users',         label: 'Users',         icon: <Users      style={{ width: 13, height: 13 }} />, advisor: false },
  { id: 'growth',        label: 'Growth',        icon: <BarChart3  style={{ width: 13, height: 13 }} />, advisor: true  },
  { id: 'revenue',       label: 'Revenue',       icon: <DollarSign style={{ width: 13, height: 13 }} />, advisor: true  },
  { id: 'api',           label: 'API',           icon: <Key        style={{ width: 13, height: 13 }} />, advisor: false },
  { id: 'notifications', label: 'Notifications', icon: <Bell       style={{ width: 13, height: 13 }} />, advisor: false },
  { id: 'alerts',        label: 'Alerts',        icon: <Activity   style={{ width: 13, height: 13 }} />, advisor: false },
  { id: 'ops',           label: 'Ops',           icon: <Cog        style={{ width: 13, height: 13 }} />, advisor: false },
  { id: 'feedback',      label: 'Feedback',      icon: <Bug        style={{ width: 13, height: 13 }} />, advisor: false },
];

// ────────────────────────────────────────────────────────────────────
// Health-score helper — combines notification delivery + DB sanity
// ────────────────────────────────────────────────────────────────────
function computeHealthScore(stats: StatsResp | null): { label: string; detail: string; tone: string } {
  if (!stats) return { label: '—', detail: 'Stats loading…', tone: 'cyan' };
  const n = stats.notifications;
  const successPct = n && n.total > 0 ? (n.sent / n.total) * 100 : 100;
  if (successPct < 80) {
    return { label: 'Issues', detail: `Notif delivery ${successPct.toFixed(0)}%`, tone: 'rose' };
  }
  if (successPct < 95) {
    return { label: 'Degraded', detail: `Notif delivery ${successPct.toFixed(0)}%`, tone: 'amber' };
  }
  return { label: 'Healthy', detail: `${stats.dbSize} DB · ${fmtNumber(stats.totals.fundingSnapshots)} snaps`, tone: 'emerald' };
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────
export default function AdminPanelPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isAdmin   = role === 'admin';
  const isAdvisor = role === 'advisor';
  const hasAccess = isAdmin || isAdvisor;

  // Tabs filtered by role — advisor only sees overview + growth.
  const visibleTabs = useMemo(
    () => ALL_TABS.filter(t => isAdmin || t.advisor),
    [isAdmin],
  );

  const [active, setActive] = useState<TabId>('overview');
  const [stats, setStats]   = useState<StatsResp | null>(null);
  const [audit, setAudit]   = useState<AuditEntry[]>([]);
  const [openBugCount, setOpenBugCount] = useState<{ high: number; total: number } | null>(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const [onlineNow, setOnlineNow]       = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now()); // ticks every second for the countdown
  const [toast, setToast] = useState<ToastMsg | null>(null);

  // ─── Hash routing ────────────────────────────────────────────────
  // Wait for the session to load before resolving the tab — otherwise
  // a deep-link to #users on first render snaps to #overview because
  // isAdmin is still false (visibleTabs only has the advisor subset).
  useEffect(() => {
    if (status !== 'authenticated') return;
    const applyHash = () => {
      const id = (window.location.hash.replace(/^#/, '') || 'overview') as TabId;
      if (visibleTabs.some(t => t.id === id)) {
        setActive(id);
      } else {
        // User landed on a hidden tab via stale URL → snap to overview
        setActive('overview');
        if (id) history.replaceState(null, '', '#overview');
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [visibleTabs, status]);

  const goTab = useCallback((id: TabId) => {
    history.replaceState(null, '', `#${id}`);
    setActive(id);
  }, []);

  // ─── Data loader ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setRefreshing(true);
    const tasks: Promise<void>[] = [];

    // Stats
    tasks.push(
      fetch('/api/admin/stats')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && !d.error) setStats(d as StatsResp); })
        .catch(() => {}),
    );

    // Audit log tail (10 most recent for Overview)
    tasks.push(
      fetch('/api/admin/audit-log?limit=10')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          const list: AuditEntry[] =
            Array.isArray(d.entries) ? d.entries :
            Array.isArray(d.events)  ? d.events.map((e: any) => ({
              id: String(e.id),
              action: e.type,
              actorEmail: e.details?.admin ?? null,
              actorName:  e.details?.actorName ?? null,
              timestamp: e.timestamp,
              metadata: e.details,
            })) :
            Array.isArray(d) ? d : [];
          setAudit(list.slice(0, 10));
        })
        .catch(() => {}),
    );

    // Bug-report counts (red banner). /api/feedback GET is admin-only —
    // advisors get 403, so skip the fetch entirely for them. Their red
    // banner just won't surface the bug-count condition; everything
    // else still works.
    if (isAdmin) {
      tasks.push(
        fetch('/api/feedback?status=open&limit=100')
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d?.success || !Array.isArray(d.data)) return;
            const list = d.data as BugReport[];
            setOpenBugCount({
              high: list.filter(r => r.severity === 'high').length,
              total: list.length,
            });
          })
          .catch(() => {}),
      );
    }

    await Promise.allSettled(tasks);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => {
    if (!hasAccess) return;
    load();
    const id = setInterval(load, 120_000); // 2-min auto-refresh
    return () => clearInterval(id);
  }, [hasAccess, load]);

  // Online-now widget — fast 30s poll, independent of the heavier 2-min
  // stats poll so the "live right now" indicator stays responsive.
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    const pull = () => {
      fetch('/api/admin/online-now?minutes=5')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancelled && d && typeof d.count === 'number') setOnlineNow(d.count); })
        .catch(() => {});
    };
    pull();
    const id = setInterval(pull, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [hasAccess]);

  // 1Hz tick — feeds the "next refresh in Xs" countdown so the header
  // doesn't go stale-looking between polls. Cheap enough — single
  // setState every second when the dashboard is open.
  useEffect(() => {
    if (!hasAccess) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasAccess]);

  // ─── Red-banner conditions ───────────────────────────────────────
  const bannerMessages = useMemo(() => {
    const msgs: string[] = [];
    if (openBugCount && openBugCount.high > 0) {
      msgs.push(`${openBugCount.high} high-severity bug report${openBugCount.high === 1 ? '' : 's'} open`);
    }
    if (stats?.notifications && stats.notifications.total > 0) {
      const pct = (stats.notifications.sent / stats.notifications.total) * 100;
      if (pct < 80) {
        msgs.push(`Notification delivery degraded · ${pct.toFixed(0)}% success (7d)`);
      }
    }
    return msgs;
  }, [openBugCount, stats]);

  // ─── Toast helpers ───────────────────────────────────────────────
  const fireToast = useCallback((msg: string, ok: boolean) => setToast({ msg, ok }), []);

  // ─── Auth gate ───────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{
            width: 32, height: 32,
            border: '2px solid rgba(251, 191, 36, 0.3)',
            borderTopColor: '#fbbf24',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
        </main>
        <Footer />
      </div>
    );
  }
  if (!session?.user || !hasAccess) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '80px 16px', color: '#fff',
        }}>
          <Lock style={{ width: 28, height: 28, color: '#fbbf24', marginBottom: 14 }} />
          <div style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 14 }}>Admin or advisor access required</div>
          <a
            href="/login?callbackUrl=/admin-panel"
            style={{
              padding: '8px 18px', borderRadius: 8,
              background: '#fbbf24', color: '#000',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Log in
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  const sysHealth = computeHealthScore(stats);

  // ─── Page shell ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main style={{ color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

          {/* Mobile guard — dashboard is desktop-only by design */}
          <div className="md:hidden" style={{
            background: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: 8, padding: 16, marginBottom: 16,
            color: '#fcd34d', fontSize: 13, textAlign: 'center',
          }}>
            The admin dashboard is optimised for desktop (1024px+). Many tables and modals will look cramped on this screen.
          </div>

          {/* Header bar */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, marginBottom: 18,
          }}>
            <div>
              <h1 style={{
                fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Shield style={{ width: 18, height: 18, color: '#fbbf24' }} />
                Admin Dashboard
                {isAdvisor && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#7dd3fc', background: 'rgba(125, 211, 252, 0.12)',
                    padding: '3px 8px', borderRadius: 999,
                    border: '1px solid rgba(125, 211, 252, 0.25)',
                  }}>Advisor</span>
                )}
              </h1>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                Live operations + product analytics · refresh every 2 min
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Online-now pill — pulsing dot + count of users seen in last 5 min */}
              <span title="Users active in the last 5 minutes" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 999,
                fontSize: 10.5, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: '#86efac',
                fontFamily: 'var(--font-mono)',
              }}>
                <span className="pulse-success" style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34,197,94,0.7)',
                }} />
                {onlineNow === null ? '—' : onlineNow} online
              </span>

              {/* Refresh countdown — text-only, ticks every second */}
              {lastRefresh && (() => {
                const elapsed = Math.max(0, Math.floor((now - lastRefresh.getTime()) / 1000));
                const nextIn = Math.max(0, 120 - elapsed);
                const mm = Math.floor(nextIn / 60);
                const ss = String(nextIn % 60).padStart(2, '0');
                return (
                  <span title={`Last refresh at ${lastRefresh.toLocaleTimeString()}`} style={{
                    fontSize: 10, color: 'var(--fg-faint)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    next refresh {mm}:{ss}
                  </span>
                );
              })()}

              <button
                type="button"
                onClick={load}
                disabled={refreshing}
                style={{
                  fontSize: 11, color: 'var(--fg-default)',
                  background: 'transparent', border: 0, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  opacity: refreshing ? 0.5 : 1,
                }}
              >
                <RefreshCw style={{
                  width: 13, height: 13,
                  ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}),
                }} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 14,
            borderBottom: '1px solid var(--hub-border-subtle)',
          }}>
            {visibleTabs.map(t => {
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goTab(t.id)}
                  style={{
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 0,
                    borderBottom: `2px solid ${isActive ? 'var(--hub-accent)' : 'transparent'}`,
                    color: isActive ? '#fff' : 'var(--fg-muted)',
                    fontSize: 12, fontWeight: 600,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginBottom: -1,
                    transition: 'color 120ms',
                    position: 'relative',
                  }}
                >
                  {t.icon}
                  {t.label}
                  {t.id === 'feedback' && openBugCount && openBugCount.total > 0 && (
                    <span style={{
                      marginLeft: 2, padding: '0 6px', minWidth: 18, height: 16,
                      fontSize: 9, fontWeight: 700,
                      borderRadius: 999,
                      background: openBugCount.high > 0 ? '#f43f5e' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {openBugCount.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Red banner */}
          <RedBanner messages={bannerMessages} />

          {/* Tab content */}
          <div style={{ minHeight: 400 }}>
            {active === 'overview'      && <OverviewTab      stats={stats} audit={audit} sysHealth={sysHealth} />}
            {active === 'users'         && isAdmin && <UsersTab        onToast={fireToast} />}
            {active === 'growth'        && <GrowthTab        stats={stats} />}
            {active === 'revenue'       && <RevenueTab />}
            {active === 'api'           && isAdmin && <ApiAnalyticsTab />}
            {active === 'notifications' && isAdmin && <NotificationsTab stats={stats} />}
            {active === 'alerts'        && isAdmin && <AlertsHealthTab />}
            {active === 'ops'           && isAdmin && <OpsTab          onToast={fireToast} />}
            {active === 'feedback'      && isAdmin && <FeedbackTab     onToast={fireToast} />}
          </div>
        </div>
      </main>
      <Footer />
      <ToastHost toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
