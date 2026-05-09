'use client';

/**
 * /account — Account Command Center
 *
 * The opinionated, glanceable home for everything personal:
 *   - Hero: greeting + plan badge + member-since
 *   - 4 big stat cards (positions / watched wallets / alerts / watchlist)
 *   - Connected venues row (chips with health)
 *   - Watched wallets preview (top 3 by activity, links to /watch)
 *   - Recent notifications feed (alerts that fired)
 *   - Quick actions strip (jump into the deep-dive pages)
 *
 * Distinct from /dashboard (customizable widget grid for market data) and
 * /profile (settings + connections + danger zone). This page is the
 * "what do I want to know about MY trading right now" view.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Activity, Bell, Star, Eye, Wallet, ArrowRight, Loader2, Shield,
  Sparkles, ShieldCheck, Send, KeyRound, BarChart3, Settings,
  Layers, Briefcase, Calendar, ExternalLink,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils/format';

interface AccountStats {
  memberSince: string | null;
  watchlistCount: number;
  alertCount: number;
  portfolioCount: number;
  connectedProviders: string[];
  recentNotifications: Array<{
    symbol: string;
    metric: string;
    threshold: number;
    actualValue: number;
    channel: string;
    sentAt: string;
  }>;
}

interface WatchedWallet {
  id: number;
  address: string;
  label: string | null;
}
interface WatchEvent {
  id: number;
  address: string;
  venue: 'hyperliquid' | 'gtrade';
  symbol: string;
  kind: string;
  ts: string;
}
interface WatchData { wallets: WatchedWallet[]; events: WatchEvent[] }

function shortAddr(a: string): string {
  if (!a) return '0x…';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function relTime(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [watch, setWatch] = useState<WatchData | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);

  const userId = session?.user?.id;
  const load = useCallback(async () => {
    if (!userId) return;
    const [s, w, tg] = await Promise.allSettled([
      fetch('/api/user/stats').then(r => r.ok ? r.json() : null),
      fetch('/api/watch/wallets').then(r => r.ok ? r.json() : null),
      fetch('/api/telegram/link-code').then(r => r.ok ? r.json() : null),
    ]);
    if (s.status === 'fulfilled' && s.value) setStats(s.value);
    if (w.status === 'fulfilled' && w.value) setWatch(w.value);
    if (tg.status === 'fulfilled' && tg.value) setTelegramLinked(!!tg.value.linked);
  }, [userId]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    load();
  }, [status, load]);

  // ── Auth gates ────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="max-w-[640px] mx-auto px-4 py-12">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
            <Shield className="w-10 h-10 text-hub-yellow mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Sign in to your account</h1>
            <p className="text-sm text-neutral-400 mb-5">Watchlist, alerts, connected wallets, and Telegram pings live behind login.</p>
            <Link href="/login?callbackUrl=/account" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:bg-hub-yellow/90">
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Trader';
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = userRole === 'admin';
  const wallets = watch?.wallets ?? [];
  const events = watch?.events ?? [];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white">
        {/* ─── Hero ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-white/[0.04]">
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'radial-gradient(circle at 30% 30%, #eab308, transparent 60%)' }} />
          <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 py-7">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
                    Welcome back, {userName}
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-400/30">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-400/30">
                    <Sparkles className="w-3 h-3" />
                    Free plan
                  </span>
                </div>
                {stats?.memberSince && (
                  <p className="text-[11px] text-neutral-600 font-mono mt-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Member since {new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link href="/profile" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-3 py-2 rounded-lg border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </Link>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <StatCell
                icon={<Briefcase className="w-3.5 h-3.5" />}
                label="Connected"
                value={stats?.connectedProviders.length ?? 0}
                hint={stats?.connectedProviders.slice(0, 3).join(' · ') || 'no wallets'}
                href="/profile?tab=connections"
                accent="from-violet-500/20"
              />
              <StatCell
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Watched wallets"
                value={wallets.length}
                hint={wallets.length === 0 ? 'add one in /watch' : `${events.length} recent events`}
                href="/watch"
                accent="from-emerald-500/20"
              />
              <StatCell
                icon={<Bell className="w-3.5 h-3.5" />}
                label="Active alerts"
                value={stats?.alertCount ?? 0}
                hint={`${stats?.recentNotifications?.length ?? 0} fired recently`}
                href="/alerts"
                accent="from-rose-500/20"
              />
              <StatCell
                icon={<Star className="w-3.5 h-3.5" />}
                label="Watchlist"
                value={stats?.watchlistCount ?? 0}
                hint="symbols tracked"
                href="/watchlist"
                accent="from-amber-500/20"
              />
            </div>
          </div>
        </section>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* ─── Telegram banner if not linked ─────────────────────── */}
          {telegramLinked === false && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3 flex-wrap">
              <Send className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-amber-300">Link Telegram for alerts</div>
                <div className="text-xs text-neutral-400">Watched-wallet alerts, position alerts, and security notifications won&apos;t deliver until you link.</div>
              </div>
              <Link href="/profile?tab=notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded-lg border border-amber-400/40 hover:bg-amber-500/10">
                Link now <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* ─── 2-col: Watched wallets + Recent activity ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Watched wallets */}
            <SectionCard title="Watched wallets" icon={Eye} cta={{ href: '/watch', label: 'Manage all' }}>
              {wallets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] py-6 text-center text-xs text-neutral-500">
                  No wallets watched.{' '}
                  <Link href="/watch" className="text-hub-yellow hover:underline">Add one</Link>
                  {' '}to get pinged on opens/closes/size changes/liq.
                </div>
              ) : (
                <ul className="space-y-1">
                  {wallets.slice(0, 4).map(w => {
                    const lastEvent = events.find(e => e.address === w.address);
                    return (
                      <li key={w.id} className="px-3 py-2 rounded-lg hover:bg-white/[0.02] flex items-center gap-3">
                        <Link href="/watch" className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{w.label || shortAddr(w.address)}</div>
                          {w.label && <div className="text-[11px] font-mono text-neutral-600 truncate">{shortAddr(w.address)}</div>}
                        </Link>
                        {lastEvent ? (
                          <span className="text-[10px] font-mono text-neutral-600 shrink-0">
                            {lastEvent.kind} · {relTime(lastEvent.ts)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-700 italic shrink-0">no events yet</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            {/* Recent activity */}
            <SectionCard title="Recent activity" icon={Activity} cta={{ href: '/profile?tab=activity', label: 'Full log' }}>
              {(stats?.recentNotifications?.length ?? 0) === 0 && events.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] py-6 text-center text-xs text-neutral-500">
                  No activity yet. Set up an alert or watch a wallet to start seeing events.
                </div>
              ) : (
                <ul className="space-y-1">
                  {/* Merge watch events + alert notifications, newest first, top 6 */}
                  {[
                    ...events.map(e => ({ kind: 'watch' as const, ts: e.ts, sym: e.symbol, label: e.kind, channel: e.venue })),
                    ...(stats?.recentNotifications ?? []).map(n => ({ kind: 'alert' as const, ts: n.sentAt, sym: n.symbol, label: `${n.metric} ≥ ${n.threshold}`, channel: n.channel })),
                  ]
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .slice(0, 6)
                    .map((row, i) => (
                      <li key={i} className="px-3 py-2 flex items-center gap-3 text-xs hover:bg-white/[0.02] rounded">
                        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                          row.kind === 'watch'
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-400/30'
                        }`}>
                          {row.kind === 'watch' ? 'WATCH' : 'ALERT'}
                        </span>
                        <span className="font-mono font-bold text-white shrink-0 w-12 truncate">{row.sym}</span>
                        <span className="text-neutral-400 truncate">{row.label}</span>
                        <span className="text-[10px] font-mono text-neutral-600 ml-auto shrink-0">{relTime(row.ts)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* ─── Quick actions ────────────────────────────────────── */}
          <SectionCard title="Quick actions" icon={Layers}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <QuickAction href="/positions" icon={Briefcase} label="Positions" desc="Cross-venue book" />
              <QuickAction href="/positions/journal" icon={BarChart3} label="Trade Journal" desc="Closed trades" />
              <QuickAction href="/positions/simulate" icon={Activity} label="Simulate" desc="Pre-trade engine" />
              <QuickAction href="/positions/tax" icon={Calendar} label="Tax / Cost-Basis" desc="FIFO realised" />
              <QuickAction href="/profile?tab=api-keys" icon={KeyRound} label="API Keys" desc="v1 access tokens" />
              <QuickAction href="/profile?tab=connections" icon={Wallet} label="Connections" desc="Wallets + keys" />
            </div>
          </SectionCard>

          {/* ─── Plan + footer hint ───────────────────────────────── */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-neutral-600">
              On the Free plan ·{' '}
              <Link href="/profile?tab=billing" className="text-hub-yellow hover:underline">
                see billing
              </Link>
              {' '}·{' '}
              <Link href="/changelog" className="text-hub-yellow hover:underline">
                what&apos;s new
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCell({
  icon, label, value, hint, href, accent,
}: {
  icon: React.ReactNode; label: string; value: number; hint: string; href: string; accent: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br ${accent} to-transparent px-3.5 py-3 hover:border-white/[0.14] transition-all`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">
        <span className="text-neutral-500">{icon}</span>
        {label}
        <ArrowRight className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="text-2xl font-bold font-mono tabular-nums text-white">{value}</div>
      <div className="text-[10px] text-neutral-500 mt-0.5 truncate">{hint}</div>
    </Link>
  );
}

function SectionCard({
  title, icon: Icon, cta, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  cta?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <header className="flex items-baseline justify-between gap-3 mb-3 px-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-hub-yellow" />
          {title}
        </h2>
        {cta && (
          <Link href={cta.href} className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1">
            {cta.label}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function QuickAction({
  href, icon: Icon, label, desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] px-3 py-2.5 transition-all"
    >
      <Icon className="w-4 h-4 text-hub-yellow group-hover:scale-110 transition-transform" />
      <div className="text-xs font-semibold text-white">{label}</div>
      <div className="text-[10px] text-neutral-600">{desc}</div>
    </Link>
  );
}
