'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Shield, Users, Database, Bell, BarChart3, TrendingUp, Zap,
  RefreshCw, Send, Activity, Settings,
} from 'lucide-react';
import { ToastProvider } from './components/Toast';
import TabBar, { type AdminTab } from './components/TabBar';
import StatCardWithSparkline from './components/StatCardWithSparkline';
import { StatGridSkeleton } from './components/AdminSkeletons';
import OverviewTab from './components/OverviewTab';
import PipelineTab from './components/PipelineTab';
import AlertsTab from './components/AlertsTab';
import DatabaseTab from './components/DatabaseTab';
import UsersTab from './components/UsersTab';
import ActionsTab from './components/ActionsTab';

interface SiteStats {
  totals: {
    users: number;
    alertNotifications: number;
    fundingSnapshots: number;
    oiSnapshots: number;
    liquidationSnapshots: number;
    telegramUsers: number;
    pushSubscriptions: number;
  };
  last24h: {
    alertNotifications: number;
    fundingSnapshots: number;
    liquidationSnapshots: number;
  };
  trends?: {
    alerts: number[];
    funding: number[];
    oi: number[];
    liquidations: number[];
  };
  dbSize: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'pipeline', label: 'Pipeline', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="w-3.5 h-3.5" /> },
  { id: 'database', label: 'Database', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'users', label: 'Users', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'actions', label: 'Actions', icon: <Settings className="w-3.5 h-3.5" /> },
];

export default function AdminPanelPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tabKey, setTabKey] = useState(0);

  const userRole = session?.user?.role;
  const hasAdminAccess = userRole === 'admin' || userRole === 'advisor';


  // Hash routing
  useEffect(() => {
    const readHash = () => {
      const h = window.location.hash.replace('#', '') as AdminTab;
      if (TABS.some((t) => t.id === h)) setActiveTab(h);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) setStats(await res.json());
    } catch {}
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    if (!hasAdminAccess) return;
    setStatsLoading(true);
    loadStats().finally(() => setStatsLoading(false));
  }, [session, loadStats]);

  // Auto-refresh stats every 2 min
  useEffect(() => {
    if (!hasAdminAccess) return;
    const interval = setInterval(loadStats, 120_000);
    return () => clearInterval(interval);
  }, [session, loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setTabKey((k) => k + 1);
    setRefreshing(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!session?.user || !hasAdminAccess) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="flex flex-col items-center justify-center py-20 text-white">
          <div className="text-neutral-400 text-sm mb-3">Admin access required</div>
          <a href="/login" className="px-4 py-2 rounded-lg bg-hub-yellow text-black text-sm font-medium hover:brightness-110 transition-all">
            Log In
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="text-white">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-hub-yellow" />
                  Admin Panel
                </h1>
                <p className="text-xs text-neutral-600 mt-0.5">System monitoring and management</p>
              </div>
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-[10px] text-neutral-600">
                    {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-xs text-neutral-500 hover:text-white flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            {statsLoading ? (
              <StatGridSkeleton />
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatCardWithSparkline
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="Total Users"
                  value={stats.totals.users}
                />
                <StatCardWithSparkline
                  icon={<Bell className="w-3.5 h-3.5" />}
                  label="Alerts Fired"
                  value={stats.totals.alertNotifications}
                  sub={`${formatNumber(stats.last24h.alertNotifications)} today`}
                  trend={stats.trends?.alerts}
                  trendColor="#f59e0b"
                />
                <StatCardWithSparkline
                  icon={<TrendingUp className="w-3.5 h-3.5" />}
                  label="Funding Snaps"
                  value={stats.totals.fundingSnapshots}
                  sub={`${formatNumber(stats.last24h.fundingSnapshots)} today`}
                  trend={stats.trends?.funding}
                  trendColor="#22c55e"
                />
                <StatCardWithSparkline
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="Liq Snaps"
                  value={stats.totals.liquidationSnapshots}
                  sub={`${formatNumber(stats.last24h.liquidationSnapshots)} today`}
                  trend={stats.trends?.liquidations}
                  trendColor="#ef4444"
                />
                <StatCardWithSparkline
                  icon={<BarChart3 className="w-3.5 h-3.5" />}
                  label="OI Snapshots"
                  value={stats.totals.oiSnapshots}
                  trend={stats.trends?.oi}
                  trendColor="#3b82f6"
                />
                <StatCardWithSparkline
                  icon={<Send className="w-3.5 h-3.5" />}
                  label="Telegram"
                  value={stats.totals.telegramUsers}
                />
                <StatCardWithSparkline
                  icon={<Bell className="w-3.5 h-3.5" />}
                  label="Push Subs"
                  value={stats.totals.pushSubscriptions}
                />
                <StatCardWithSparkline
                  icon={<Database className="w-3.5 h-3.5" />}
                  label="DB Size"
                  value={stats.dbSize}
                  raw
                />
              </div>
            ) : null}

            {/* Tab Bar */}
            <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

            {/* Tab Content */}
            <div className="mt-4" key={tabKey}>
              {activeTab === 'overview' && <OverviewTab onNavigate={handleTabChange} />}
              {activeTab === 'pipeline' && <PipelineTab />}
              {activeTab === 'alerts' && <AlertsTab />}
              {activeTab === 'database' && <DatabaseTab />}
              {activeTab === 'users' && <UsersTab userRole={userRole} currentUserId={session.user.id} />}
              {activeTab === 'actions' && <ActionsTab userRole={userRole} />}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
