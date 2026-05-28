'use client';

/**
 * /marketing-panel — marketer/growth dashboard.
 *
 * Tabs:
 *   · Growth   — signups + tier mix + activation funnel + top pages.
 *   · Revenue  — projected MRR/ARR + affiliate revenue + commission.
 *
 * Sub-page links (header):
 *   · /admin-panel/affiliates — full affiliate operator view
 *   · /admin-panel/broadcast  — broadcast composer
 *
 * Visible to: owner, admin, marketer.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Shield, BarChart3, DollarSign, RefreshCw, Lock, Megaphone, Gift, Send, TrendingUp, Activity } from 'lucide-react';
import { GrowthTab }      from '../admin-panel/tabs/Growth';
import { RevenueTab }     from '../admin-panel/tabs/Revenue';
import { AcquisitionTab } from '../admin-panel/tabs/Acquisition';
import { CampaignsTab }   from '../admin-panel/tabs/Campaigns';
import { AnalyticsTab }   from '../admin-panel/tabs/Analytics';
import { ToastHost, type ToastMsg } from '../admin-panel/components/primitives';
import type { StatsResp } from '../admin-panel/types';

type TabId = 'growth' | 'analytics' | 'acquisition' | 'campaigns' | 'revenue';

interface TabDef { id: TabId; label: string; icon: React.ReactNode }
const TABS: TabDef[] = [
  { id: 'growth',      label: 'Growth',      icon: <BarChart3  style={{ width: 13, height: 13 }} /> },
  { id: 'analytics',   label: 'Analytics',   icon: <Activity   style={{ width: 13, height: 13 }} /> },
  { id: 'acquisition', label: 'Acquisition', icon: <TrendingUp style={{ width: 13, height: 13 }} /> },
  { id: 'campaigns',   label: 'Campaigns',   icon: <Megaphone  style={{ width: 13, height: 13 }} /> },
  { id: 'revenue',     label: 'Revenue',     icon: <DollarSign style={{ width: 13, height: 13 }} /> },
];

export default function MarketingPanelPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const allowed = role === 'owner' || role === 'admin' || role === 'marketer';

  const [active, setActive] = useState<TabId>('growth');
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const fireToast = useCallback((msg: string, ok: boolean) => setToast({ msg, ok }), []);

  // Hash routing
  useEffect(() => {
    if (status !== 'authenticated') return;
    const apply = () => {
      const id = (window.location.hash.replace(/^#/, '') || 'growth') as TabId;
      if (TABS.some(t => t.id === id)) setActive(id);
      else { setActive('growth'); history.replaceState(null, '', '#growth'); }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [status]);

  const goTab = useCallback((id: TabId) => {
    history.replaceState(null, '', `#${id}`);
    setActive(id);
  }, []);

  // Stats loader — Growth tab consumes stats.users + stats.totals
  const load = useCallback(async () => {
    if (!allowed) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const d = await res.json();
        if (!d.error) setStats(d as StatsResp);
      }
    } catch {}
    setLastRefresh(new Date());
    setRefreshing(false);
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [allowed, load]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const digit = parseInt(e.key, 10);
        if (Number.isFinite(digit) && digit >= 1 && digit <= TABS.length) {
          e.preventDefault();
          goTab(TABS[digit - 1].id);
        }
      }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); load(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [allowed, goTab, load]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(196, 181, 253, 0.3)', borderTopColor: '#c4b5fd', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </main>
        <Footer />
      </div>
    );
  }
  if (!session?.user || !allowed) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 16px', color: '#fff' }}>
          <Lock style={{ width: 28, height: 28, color: '#c4b5fd', marginBottom: 14 }} />
          <div style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 14 }}>Marketer access required</div>
          <a href="/login?callbackUrl=/marketing-panel" style={{ padding: '8px 18px', borderRadius: 8, background: '#c4b5fd', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Log in</a>
        </main>
        <Footer />
      </div>
    );
  }

  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main style={{ color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone style={{ width: 18, height: 18, color: '#c4b5fd' }} />
                Marketing Panel
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#c4b5fd', background: 'rgba(196, 181, 253, 0.12)',
                  padding: '3px 8px', borderRadius: 999,
                  border: '1px solid rgba(196, 181, 253, 0.25)',
                }}>{role}</span>
              </h1>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                Growth metrics, revenue projection, affiliate program, broadcast composer
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lastRefresh && (
                <span style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>
                  updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <button
                type="button"
                onClick={load}
                disabled={refreshing}
                style={{ fontSize: 11, color: 'var(--fg-default)', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RefreshCw style={{ width: 13, height: 13, ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}) }} />
                Refresh
              </button>
              {isOwnerOrAdmin && (
                <a href="/admin-panel" style={{ fontSize: 11, color: 'var(--fg-default)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Shield style={{ width: 13, height: 13, color: '#fbbf24' }} />
                  Full admin
                </a>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--hub-border-subtle)' }}>
            {TABS.map(t => {
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goTab(t.id)}
                  style={{
                    padding: '10px 14px', background: 'transparent', border: 0,
                    borderBottom: `2px solid ${isActive ? '#c4b5fd' : 'transparent'}`,
                    color: isActive ? '#fff' : 'var(--fg-muted)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: -1,
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Quick links to broadcast + affiliates sub-pages */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Link
              href="/admin-panel/affiliates"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px',
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: 8, fontSize: 11, color: '#34d399', textDecoration: 'none',
              }}
            >
              <Gift style={{ width: 12, height: 12 }} />
              Affiliate program · top earners + payouts
            </Link>
            <Link
              href="/admin-panel/broadcast"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px',
                background: 'rgba(251, 191, 36, 0.06)',
                border: '1px solid rgba(251, 191, 36, 0.22)',
                borderRadius: 8, fontSize: 11, color: '#fcd34d', textDecoration: 'none',
              }}
            >
              <Send style={{ width: 12, height: 12 }} />
              Broadcast composer · push + telegram
            </Link>
          </div>

          {/* Tab content — reuse the admin Growth + Revenue components.
              Both fetch /api/admin/* which already gates on admin-or-advisor;
              marketers are not in that set, so we expand the gate next
              commit. For now marketing-panel admin/owner roles work; we'll
              extend requireAdminOrAdvisor → requireDashboardRead. */}
          <div style={{ minHeight: 400 }}>
            {active === 'growth'      && <GrowthTab      stats={stats} />}
            {active === 'analytics'   && <AnalyticsTab   onToast={fireToast} />}
            {active === 'acquisition' && <AcquisitionTab onToast={fireToast} />}
            {active === 'campaigns'   && <CampaignsTab   onToast={fireToast} />}
            {active === 'revenue'     && <RevenueTab />}
          </div>
        </div>
      </main>
      <Footer />
      <ToastHost toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
