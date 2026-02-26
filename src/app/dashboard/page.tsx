'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  LayoutDashboard, Star, Bell, Wallet, Briefcase, SlidersHorizontal,
  ArrowRight, Plus, Settings, Mail, MailCheck, MailX,
  TrendingUp, TrendingDown, Eye,
} from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';

/* ─── Types ────────────────────────────────────────────────────── */

interface DashboardData {
  watchlist: string[];
  alerts: any[];
  portfolio: any[];
  wallets: any[];
  screenerPresets: any[];
  notificationPrefs?: { email: boolean; cooldownMinutes: number };
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  accent,
  children,
}: {
  icon: any;
  label: string;
  value: string | number;
  href: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-colors group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accent || 'text-hub-yellow'}`} />
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      {children}
    </Link>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load user data
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        setData({
          watchlist: json.watchlist || [],
          alerts: json.alerts || [],
          portfolio: json.portfolio || [],
          wallets: json.wallets || [],
          screenerPresets: json.screenerPresets || [],
          notificationPrefs: json.notificationPrefs,
        });
      } catch {
        // failed to load
      }
      setLoading(false);
    })();
  }, [session]);

  if (status === 'loading' || loading) {
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

  if (!session) return null;

  const d = data || {
    watchlist: [],
    alerts: [],
    portfolio: [],
    wallets: [],
    screenerPresets: [],
    notificationPrefs: undefined,
  };

  const activeAlerts = d.alerts.filter((a: any) => a.enabled !== false);
  const emailOn = d.notificationPrefs?.email !== false;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="heading-page flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-hub-yellow" />
              Dashboard
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Welcome back, {session.user?.name || session.user?.email?.split('@')[0] || 'User'}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {/* Watchlist */}
            <StatCard icon={Star} label="Watchlist" value={d.watchlist.length} href="/watchlist">
              {d.watchlist.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {d.watchlist.slice(0, 5).map((sym: string) => (
                    <span
                      key={sym}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-400"
                    >
                      <TokenIconSimple symbol={sym} size={12} />
                      {sym}
                    </span>
                  ))}
                  {d.watchlist.length > 5 && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-600">
                      +{d.watchlist.length - 5}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 mt-1">No symbols yet</p>
              )}
            </StatCard>

            {/* Alerts */}
            <StatCard
              icon={Bell}
              label="Active Alerts"
              value={activeAlerts.length}
              href="/alerts"
              accent="text-orange-400"
            >
              {activeAlerts.length > 0 ? (
                <div className="space-y-1 mt-2">
                  {activeAlerts.slice(0, 3).map((a: any, i: number) => (
                    <div key={a.id || i} className="text-xs text-neutral-500 truncate">
                      {a.symbol} {a.metric} {a.operator === 'gt' ? '>' : '<'} {a.value}
                    </div>
                  ))}
                  {activeAlerts.length > 3 && (
                    <div className="text-xs text-neutral-600">+{activeAlerts.length - 3} more</div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 mt-1">No active alerts</p>
              )}
            </StatCard>

            {/* Portfolio */}
            <StatCard
              icon={Briefcase}
              label="Portfolio"
              value={`${d.portfolio.length} holding${d.portfolio.length !== 1 ? 's' : ''}`}
              href="/portfolio"
              accent="text-green-400"
            >
              {d.portfolio.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {d.portfolio.slice(0, 4).map((h: any, i: number) => (
                    <span
                      key={h.symbol || i}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-400"
                    >
                      <TokenIconSimple symbol={h.symbol} size={12} />
                      {h.symbol}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 mt-1">No holdings yet</p>
              )}
            </StatCard>

            {/* Wallets */}
            <StatCard
              icon={Wallet}
              label="Tracked Wallets"
              value={d.wallets.length}
              href="/wallet-tracker"
              accent="text-blue-400"
            >
              {d.wallets.length > 0 ? (
                <div className="space-y-1 mt-2">
                  {d.wallets.slice(0, 2).map((w: any, i: number) => (
                    <div key={w.address || i} className="text-xs text-neutral-500 truncate font-mono">
                      {w.label || `${w.address?.slice(0, 6)}...${w.address?.slice(-4)}`}
                    </div>
                  ))}
                  {d.wallets.length > 2 && (
                    <div className="text-xs text-neutral-600">+{d.wallets.length - 2} more</div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 mt-1">No wallets tracked</p>
              )}
            </StatCard>

            {/* Screener Presets */}
            <StatCard
              icon={SlidersHorizontal}
              label="Screener Presets"
              value={d.screenerPresets.length}
              href="/screener"
              accent="text-purple-400"
            >
              {d.screenerPresets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {d.screenerPresets.slice(0, 3).map((p: any, i: number) => (
                    <span
                      key={p.name || i}
                      className="px-2 py-0.5 rounded-md bg-white/[0.04] text-xs text-neutral-400"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-600 mt-1">No saved presets</p>
              )}
            </StatCard>

            {/* Email Alerts Status */}
            <StatCard
              icon={emailOn ? MailCheck : MailX}
              label="Email Alerts"
              value={emailOn ? 'Enabled' : 'Disabled'}
              href="/settings"
              accent={emailOn ? 'text-green-400' : 'text-neutral-600'}
            >
              <p className="text-xs text-neutral-600 mt-1">
                {emailOn
                  ? `Cooldown: ${d.notificationPrefs?.cooldownMinutes || 60} min`
                  : 'Enable in settings'}
              </p>
            </StatCard>
          </div>

          {/* Quick Actions */}
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/alerts"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Plus className="w-3 h-3" />
                Create Alert
              </Link>
              <Link
                href="/screener"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Eye className="w-3 h-3" />
                Open Screener
              </Link>
              <Link
                href="/funding"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <TrendingUp className="w-3 h-3" />
                Funding Rates
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Settings className="w-3 h-3" />
                Settings
              </Link>
            </div>
          </div>

          {/* Cloud Sync Info */}
          <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              All your data is synced to the cloud and available across devices.
              Changes made on any device will automatically appear everywhere.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
