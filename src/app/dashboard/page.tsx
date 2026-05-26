'use client';

/**
 * /dashboard — Command Center (v2, May 2026)
 *
 * The canonical home for everything personal. /account redirects here
 * for legacy URLs. The customizable widget grid that used to live at
 * /dashboard moved to /dashboard/widgets.
 *
 * Layout matches the user-supplied mockup:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  HERO   avatar + name/plan/streak + actions     │ MORNING  │
 *   │                                                  │  BRIEF   │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  6-CELL STATS  equity / open PnL / alerts / watchlist /     │
 *   │                 watched wallets / exchanges                  │
 *   ├──────────────────────────────────┬──────────────────────────┤
 *   │  EQUITY CHART (real history)     │  PLAN & USAGE            │
 *   ├──────────────────────────────────┼──────────────────────────┤
 *   │  OPEN POSITIONS (live mark)      │  CONNECTED EXCHANGES     │
 *   └──────────────────────────────────┴──────────────────────────┘
 *
 * All data is real where the API exists, with credible empty states.
 * Streak counter is days-since-last-activity (proxy: positions.updatedAt
 * or recentNotifications.sentAt) — falls back to 0 when no signal.
 */

import { useEffect, useId, useMemo, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SuspendedNotice from '@/components/SuspendedNotice';
import {
  Activity, Bell, Eye, Wallet, Briefcase, ArrowRight, Loader2, Shield,
  Sparkles, ShieldCheck, Send, Plus, Filter, Flame,
  Calendar, TrendingUp, TrendingDown, Layers,
  CheckCircle2, AlertCircle, ExternalLink, Clock,
} from 'lucide-react';
import { getInviteCta } from '@/lib/inviteCta';
import { resolveUserTier, TIER_BRANDING, TIER_LIMITS } from '@/lib/constants/tiers';

// ── Suspension flag ──────────────────────────────────────────────────
// Flip to false to re-enable the real command center. The original
// code below stays in place so we can light it back up instantly
// without re-implementing or copying back from git history.
const SUSPENDED = false;

/* ────────────────────────────────────────────────────────────────── */
/*  Types — the shapes we read from the existing APIs                 */
/* ────────────────────────────────────────────────────────────────── */

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

interface PositionRow {
  id: string | number;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  liquidationPrice: number | null;
  healthScore?: number;
  healthLabel?: string;
  updatedAt?: string;
}

interface PositionsPayload {
  summary: {
    equity: number;
    nominal: number;
    totalLong: number;
    totalShort: number;
    leverageLong: number;
    leverageShort: number;
    totalUnrealizedPnl: number;
    dailyFundingCarryUsd: number | null;
  };
  positions: PositionRow[];
}

interface ConnectedWallet {
  id: number;
  chain: string;
  address: string;
  label: string | null;
}

interface ExchangeKey {
  id: number;
  exchange: string;
  label: string | null;
  keyPrefix: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
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

/* ────────────────────────────────────────────────────────────────── */
/*  Small formatters                                                  */
/* ────────────────────────────────────────────────────────────────── */

function fmtUsd(v: number | null | undefined, opts: { compact?: boolean; signed?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return '—';
  // Sign goes BEFORE the dollar sign so negatives read "-$100" not "$-100".
  // `signed` adds an explicit "+" for positive values; negatives always show "-".
  const negative = v < 0;
  const sign = negative ? '-' : opts.signed && v > 0 ? '+' : '';
  const abs = Math.abs(v);
  if (opts.compact) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function relTime(ts: string | number | null | undefined): string {
  if (ts == null) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '—';
  // Future timestamps (clock skew between server / client) — clamp to "just now"
  // rather than showing "-30s ago".
  if (ms < 0) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 30 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function initials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortAddr(a: string): string {
  if (!a) return '0x…';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                              */
/* ────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  // Suspended? Show the maintenance notice. The real implementation is
  // factored into RealDashboardPage below so flipping SUSPENDED back to
  // false instantly re-enables the full command center.
  if (SUSPENDED) {
    return (
      <div className="min-h-screen bg-hub-black text-white">
        <Header />
        <SuspendedNotice
          title="Dashboard paused"
          description="We're polishing the command center experience. It'll be back online shortly with real equity history, live positions, and connected exchanges. Existing data is safe."
          primaryCta={{ href: '/', label: 'Back to home' }}
          secondaryCta={{ href: '/positions', label: 'View positions' }}
        />
        <Footer />
      </div>
    );
  }
  return <RealDashboardPage />;
}

function RealDashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [positions, setPositions] = useState<PositionsPayload | null>(null);
  const [wallets, setWallets] = useState<ConnectedWallet[]>([]);
  const [keys, setKeys] = useState<ExchangeKey[]>([]);
  const [watch, setWatch] = useState<{ wallets: WatchedWallet[]; events: WatchEvent[] } | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [equityHistory, setEquityHistory] = useState<Array<{ t: number; value: number; pnl: number }>>([]);
  const [inviteStats, setInviteStats] = useState<{ signups: number; verified: number } | null>(null);
  // True until the first load() resolves — used to suppress "no data" empty
  // states during the initial fetch so users with data don't see a brief
  // misleading "Connect a wallet" CTA flash before the API responds.
  const [initialized, setInitialized] = useState(false);

  const userId = session?.user?.id;

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    const opts = signal ? { signal } : undefined;
    const fetchJson = (url: string) =>
      fetch(url, opts).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [s, p, w, k, watchRes, tg, history, inv] = await Promise.allSettled([
      fetchJson('/api/user/stats'),
      fetchJson('/api/account/positions'),
      fetchJson('/api/account/wallets'),
      fetchJson('/api/account/exchange-keys'),
      fetchJson('/api/watch/wallets'),
      fetchJson('/api/telegram/link-code'),
      fetchJson('/api/account/history?days=30'),
      fetchJson('/api/invite/stats'),
    ]);
    // Bail if aborted mid-flight — don't setState on an unmounted component.
    if (signal?.aborted) return;
    // Re-check abort before EACH setState. Unmount can race in between
    // the initial check and any individual setter, so we tighten the
    // window by re-checking on every line. Cheap (just a getter), worth
    // it for the no-warning unmount.
    const stillAlive = () => !signal?.aborted;
    if (stillAlive() && s.status === 'fulfilled' && s.value) setStats(s.value);
    if (stillAlive() && p.status === 'fulfilled' && p.value) setPositions(p.value);
    if (stillAlive() && w.status === 'fulfilled' && w.value) setWallets(w.value.wallets ?? []);
    if (stillAlive() && k.status === 'fulfilled' && k.value) setKeys(k.value.keys ?? []);
    if (stillAlive() && watchRes.status === 'fulfilled' && watchRes.value) setWatch(watchRes.value);
    if (stillAlive() && tg.status === 'fulfilled' && tg.value) setTelegramLinked(!!tg.value.linked);
    if (stillAlive() && history.status === 'fulfilled' && history.value?.points) {
      setEquityHistory(history.value.points);
    }
    if (stillAlive() && inv.status === 'fulfilled' && inv.value && typeof inv.value.signups === 'number') {
      setInviteStats({ signups: inv.value.signups, verified: inv.value.verified });
    }
    if (stillAlive()) setInitialized(true);
  }, [userId]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Track the current in-flight controller across ticks so we can
    // cancel it on unmount or before the next tick fires. Without
    // this, a slow request from tick N can resolve after tick N+1
    // and clobber fresher state.
    let current = new AbortController();
    load(current.signal);
    const t = setInterval(() => {
      current.abort();
      current = new AbortController();
      load(current.signal);
    }, 60_000);
    return () => {
      clearInterval(t);
      current.abort();
    };
  }, [status, load]);

  /* ── Derived values ─────────────────────────────────────────── */
  // Note: auth-state gates (loading / unauthenticated) used to live HERE
  // (before any useMemo). That broke React's hooks-must-render-in-same-order
  // rule on the loading → authenticated transition: render 1 had N hooks,
  // render 2 jumped past the early returns and called extra useMemos →
  // React error #310 ("Rendered more hooks than during the previous
  // render"). The auth gates were moved BELOW all hooks (just before the
  // main return) so the hook count is identical every render. Caught
  // during Chrome QA — dashboard was crashing into the error boundary
  // for the first second of every authenticated load.
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Trader';
  const userEmail = session?.user?.email ?? null;
  const userImage = session?.user?.image ?? null;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = userRole === 'admin';
  // Resolve the user's tier via the same helper /pricing + UserMenu use,
  // so the dashboard plan label can't drift from the rest of the site.
  // Admins auto-resolve to whale; non-admins to free until billing wiring.
  const userTier = resolveUserTier({
    role: userRole,
    billingTier: (session?.user as { billingTier?: string } | undefined)?.billingTier ?? null,
  });
  // Admin gets the explicit "Admin" badge (covers the staff case); other
  // users get the tier label they'd see anywhere else (Free / Pro / Whale).
  const planName = isAdmin ? 'Admin' : TIER_BRANDING[userTier].label;
  const planTone = isAdmin ? 'rose' : 'emerald';

  // Streak proxy: count consecutive days going back from today where we
  // have ANY signal (a notification fired or a position changed). Real
  // implementation needs a daily "logged_in" log; this gives a credible
  // number from existing data.
  const streak = useMemo(() => computeStreak({
    notifications: stats?.recentNotifications ?? [],
    positions: positions?.positions ?? [],
    events: watch?.events ?? [],
  }), [stats, positions, watch]);

  const equity = positions?.summary.equity ?? 0;
  // Sum of unrealised PnL across all open positions — NOT a 24h delta.
  // Real 24h PnL needs a snapshot from yesterday; until that lands,
  // we surface "open PnL" honestly rather than mislabeling it.
  const openUnrealized = positions?.summary.totalUnrealizedPnl ?? 0;
  const totalPositions = positions?.positions.length ?? 0;
  // Count unique venues across wallets (by chain) and exchange keys (by exchange).
  // A user with 3 EVM addresses on Arbitrum + 1 Binance key counts as 2 venues.
  const venueSet = new Set<string>();
  for (const w of wallets) venueSet.add(`chain:${w.chain.toLowerCase()}`);
  for (const k of keys) venueSet.add(`exchange:${k.exchange.toLowerCase()}`);
  const exchangesConnected = venueSet.size;
  const exchangesPossible = 4; // HL / Binance / OKX / gTrade reachable target
  const watchedCount = watch?.wallets.length ?? 0;
  const eventsLast24h = (watch?.events ?? []).filter(
    e => Date.now() - new Date(e.ts).getTime() < 86_400_000,
  ).length;

  const morningBrief = useMemo(() => buildMorningBrief({
    name: userName.split(' ')[0],
    equity,
    openUnrealized,
    notifFired: stats?.recentNotifications?.length ?? 0,
    eventsLast24h,
    watchedCount,
    positions: positions?.positions ?? [],
  }), [userName, equity, openUnrealized, stats, eventsLast24h, watchedCount, positions]);

  /* ── Auth gates (AFTER all hooks — see comment above) ────────── */
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
            <p className="text-sm text-neutral-400 mb-5">
              Watchlist, alerts, connected wallets, and Telegram pings live behind login.
            </p>
            <Link
              href="/login?callbackUrl=/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:bg-hub-yellow/90"
            >
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white">
        {/* ─── Hero (avatar + identity + morning brief) ──────────────── */}
        <section className="relative overflow-hidden border-b border-white/[0.04]">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ background: 'radial-gradient(circle at 20% 30%, #eab308, transparent 55%)' }}
          />
          <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 py-7">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)] gap-6 items-start">
              {/* Identity block */}
              <div className="flex items-start gap-4">
                <Avatar name={userName} src={userImage} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
                      Welcome back, {userName}
                    </h1>
                    <PlanBadge name={planName} tone={planTone} icon={isAdmin ? ShieldCheck : Sparkles} />
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ONLINE
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1.5 flex items-center gap-3 flex-wrap">
                    {userEmail && <span className="font-mono">{userEmail}</span>}
                    {stats?.memberSince && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Member since{' '}
                        {new Date(stats.memberSince).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    {streak > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Flame className="w-3 h-3" />
                        <span className="font-mono font-bold">{streak}-day</span> streak
                      </span>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Link
                      href="/alerts"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Alert
                    </Link>
                    <Link
                      href="/screener"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08] transition-all"
                    >
                      <Filter className="w-3.5 h-3.5" /> Run screener
                    </Link>
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] bg-transparent text-neutral-300 hover:bg-white/[0.04] hover:text-white transition-all ml-auto sm:ml-0"
                    >
                      Settings
                    </Link>
                  </div>
                </div>
              </div>

              {/* Morning brief */}
              <MorningBrief lines={morningBrief} />
            </div>
          </div>
        </section>

        {/* ─── Main content ──────────────────────────────────────────── */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Telegram banner if not linked */}
          {telegramLinked === false && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3 flex-wrap">
              <Send className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-amber-300">Link Telegram for alerts</div>
                <div className="text-xs text-neutral-400">
                  Watched-wallet alerts, position alerts, and security notifications won&apos;t deliver until you link.
                </div>
              </div>
              <Link
                href="/profile?tab=notifications"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded-lg border border-amber-400/40 hover:bg-amber-500/10"
              >
                Link now <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Invite-success banner — only shows once they've referred at least
              one person. Closes the feedback loop: 'I shared the link, did
              anyone actually sign up?' answered without leaving the dashboard.
              CTA threshold (3+ verified → leaderboard) lives in lib/inviteCta.ts
              so the pivot logic is unit-tested + single-sourced. */}
          {(() => {
            if (!inviteStats) return null;
            const cta = getInviteCta(inviteStats);
            if (!cta) return null;
            return (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-3 flex-wrap">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-emerald-300">
                    {inviteStats.signups} {inviteStats.signups === 1 ? 'friend has' : 'friends have'} signed up via your link
                    {inviteStats.verified > 0 && (
                      <span className="text-emerald-400/70 font-normal">
                        {' · '}{inviteStats.verified} verified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400">{cta.subline}</div>
                </div>
                <Link
                  href={cta.href}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-400/40 hover:bg-emerald-500/10"
                >
                  {cta.label} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })()}

          {/* ─── 6-cell stats grid ─────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCell
              label="Equity"
              value={fmtUsd(equity, { compact: true })}
              hint={positions ? `${totalPositions} pos open` : 'no positions'}
              tone="white"
              icon={<Wallet className="w-3.5 h-3.5" />}
              href="/positions"
            />
            <StatCell
              label="Open PnL"
              value={fmtUsd(openUnrealized, { compact: true, signed: true })}
              hint={equity > 0 ? fmtPct((openUnrealized / equity) * 100) : '—'}
              tone={openUnrealized >= 0 ? 'emerald' : 'rose'}
              icon={openUnrealized >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              href="/positions"
            />
            <StatCell
              label="Active alerts"
              value={String(stats?.alertCount ?? 0)}
              hint={`${stats?.recentNotifications?.length ?? 0} fired recently`}
              tone="rose"
              icon={<Bell className="w-3.5 h-3.5" />}
              href="/alerts"
            />
            <StatCell
              label="Watchlist"
              value={String(stats?.watchlistCount ?? 0)}
              hint="symbols tracked"
              tone="amber"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              href="/watchlist"
            />
            <StatCell
              label="Watched wallets"
              value={String(watchedCount)}
              hint={`${eventsLast24h} events 24h`}
              tone="cyan"
              icon={<Eye className="w-3.5 h-3.5" />}
              href="/watch"
            />
            <StatCell
              label="Exchanges"
              value={`${exchangesConnected}/${exchangesPossible}`}
              hint={exchangesConnected === 0 ? 'connect to track' : 'wallets + keys'}
              tone="violet"
              icon={<Layers className="w-3.5 h-3.5" />}
              href="/profile?tab=connections"
            />
          </div>

          {/* ─── Equity chart + Plan & usage ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
            <EquityChartPanel
              equity={equity}
              openUnrealized={openUnrealized}
              positions={positions?.positions ?? []}
              history={equityHistory}
              hasData={(positions?.positions.length ?? 0) > 0 || equityHistory.length > 0}
              loading={!initialized}
            />
            <PlanUsagePanel
              planName={planName}
              userTier={userTier}
              isAdmin={isAdmin}
              watchlistCount={stats?.watchlistCount ?? 0}
              alertCount={stats?.alertCount ?? 0}
              watchedWalletsCount={watchedCount}
              exchangesConnected={exchangesConnected}
            />
          </div>

          {/* ─── Open positions + Connected exchanges ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
            <OpenPositionsTable
              positions={positions?.positions ?? []}
              hasData={positions != null}
              loading={!initialized}
            />
            <ConnectedExchangesPanel wallets={wallets} keys={keys} loading={!initialized} />
          </div>

          {/* ─── Footer hint ───────────────────────────────────────── */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-neutral-600">
              On the {planName} plan ·{' '}
              <Link href="/profile?tab=billing" className="text-hub-yellow hover:underline">
                see billing
              </Link>
              {isAdmin && (
                <>
                  {' '}·{' '}
                  <Link href="/changelog" className="text-hub-yellow hover:underline">
                    what&apos;s new
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                    */
/* ────────────────────────────────────────────────────────────────── */

function Avatar({ name, src }: { name: string; src: string | null }) {
  // Plain <img> instead of next/image — user avatars come from Vercel
  // Blob (`*.public.blob.vercel-storage.com`) which isn't in our
  // remotePatterns allowlist; next/image would throw and crash the
  // whole page for any user with a custom avatar uploaded.
  if (src) {
    return (
      <div className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          width={64}
          height={64}
          className="w-16 h-16 rounded-2xl object-cover border-2 border-hub-yellow/30"
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-hub-black" />
      </div>
    );
  }
  return (
    <div className="relative shrink-0">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-hub-yellow/30 to-amber-600/20 border-2 border-hub-yellow/30 flex items-center justify-center">
        <span className="text-2xl font-bold text-hub-yellow">{initials(name)}</span>
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-hub-black" />
    </div>
  );
}

function PlanBadge({
  name,
  tone,
  icon: Icon,
}: {
  name: string;
  tone: 'rose' | 'emerald' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls =
    tone === 'rose'
      ? 'bg-rose-500/15 text-rose-400 border-rose-400/30'
      : tone === 'amber'
        ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
        : 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      <Icon className="w-3 h-3" />
      {name}
    </span>
  );
}

function MorningBrief({ lines }: { lines: string[] }) {
  return (
    <aside className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-amber-500/[0.04] to-transparent px-4 py-3.5">
      <header className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.14em] font-bold text-amber-300/90">
        <Sparkles className="w-3 h-3" />
        Morning brief
      </header>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="text-xs text-neutral-300 leading-snug flex gap-2">
            <span className="text-amber-400/70 shrink-0">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function StatCell({
  label,
  value,
  hint,
  tone,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'white' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';
  icon: React.ReactNode;
  href: string;
}) {
  const valueColor =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'rose'
        ? 'text-rose-400'
        : tone === 'amber'
          ? 'text-amber-300'
          : tone === 'cyan'
            ? 'text-cyan-300'
            : tone === 'violet'
              ? 'text-violet-300'
              : 'text-white';
  const accentBg =
    tone === 'emerald'
      ? 'from-emerald-500/[0.08]'
      : tone === 'rose'
        ? 'from-rose-500/[0.08]'
        : tone === 'amber'
          ? 'from-amber-500/[0.08]'
          : tone === 'cyan'
            ? 'from-cyan-500/[0.08]'
            : tone === 'violet'
              ? 'from-violet-500/[0.08]'
              : 'from-white/[0.04]';
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br ${accentBg} to-transparent px-3.5 py-3 hover:border-white/[0.14] transition-all`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">
        <span className="text-neutral-500">{icon}</span>
        {label}
        <ArrowRight className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className={`text-xl font-bold font-mono tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[10px] text-neutral-500 mt-0.5 truncate">{hint}</div>
    </Link>
  );
}

/* ── Equity chart panel ─────────────────────────────────────────── */

function EquityChartPanel({
  equity,
  openUnrealized,
  positions,
  history,
  hasData,
  loading,
}: {
  equity: number;
  openUnrealized: number;
  positions: PositionRow[];
  history: Array<{ t: number; value: number; pnl: number }>;
  hasData: boolean;
  loading?: boolean;
}) {
  // Real equity series from the portfolio-snapshot cron (last 30 days).
  // Append the current equity as the most recent point so the line
  // connects history → "now" without a stale gap. When history is empty
  // (new user, no snapshots yet) the series is just one or two points
  // and the sparkline degrades into a near-flat line — which is honest.
  const series = useMemo(() => {
    const pts = history.map(h => h.value);
    if (equity > 0 && (pts.length === 0 || pts[pts.length - 1] !== equity)) {
      pts.push(equity);
    }
    return pts;
  }, [history, equity]);
  const hasHistory = series.length >= 3;

  // Subhead changes based on what data we have
  const subhead = hasHistory
    ? `${history.length}-point history · live mark`
    : 'Awaiting snapshot history · derived from open positions';

  // Top 3 positions by absolute PnL
  const topMovers = useMemo(
    () =>
      [...positions]
        .filter(p => p.unrealizedPnl != null)
        .sort((a, b) => Math.abs(b.unrealizedPnl ?? 0) - Math.abs(a.unrealizedPnl ?? 0))
        .slice(0, 3),
    [positions],
  );

  // Compute series-relative delta so the chart label tracks history,
  // not just current open PnL.
  const seriesDelta = series.length >= 2 ? series[series.length - 1] - series[0] : openUnrealized;
  const seriesPctDelta = series.length >= 2 && series[0] > 0
    ? (seriesDelta / series[0]) * 100
    : null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-hub-yellow" />
            Account equity
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">{subhead}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono tabular-nums text-white">{fmtUsd(equity, { compact: true })}</div>
          {/* Only show the delta sub-line when there's actually data — otherwise
              we'd render "+$0 (open)" for new users with empty equity, which
              is misleading (looks like a real "+0" change). */}
          {hasData && (
            <div className={`text-[11px] font-mono tabular-nums ${seriesDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtUsd(seriesDelta, { compact: true, signed: true })}
              {seriesPctDelta != null && ` (${fmtPct(seriesPctDelta)})`}
              <span className="text-neutral-600 ml-1">{hasHistory ? `${series.length - 1}d` : 'open'}</span>
            </div>
          )}
        </div>
      </header>

      {hasHistory ? (
        <Sparkline data={series} positive={seriesDelta >= 0} />
      ) : hasData ? (
        // Have positions/equity but not enough snapshots for a meaningful
        // sparkline. Show an honest "history pending" panel instead of a
        // degenerate flat line.
        <div className="h-32 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01] text-xs text-neutral-500 gap-1">
          <Activity className="w-4 h-4 text-neutral-600" />
          <span>Equity history starts after your first daily snapshot.</span>
          <span className="text-[10px] text-neutral-600">Cron runs at 12:00 UTC daily.</span>
        </div>
      ) : loading ? (
        // Initial fetch hasn't resolved — neutral skeleton, not the
        // "Connect a wallet" CTA (which would flash for users who DO
        // have data and just haven't loaded yet).
        <div className="h-32 rounded-lg border border-dashed border-white/[0.04] bg-white/[0.01] animate-pulse" />
      ) : (
        <div className="h-32 flex items-center justify-center rounded-lg border border-dashed border-white/[0.08] text-xs text-neutral-500">
          Connect a wallet or exchange in{' '}
          <Link href="/profile?tab=connections" className="text-hub-yellow hover:underline mx-1">
            Settings
          </Link>{' '}
          to see your equity curve.
        </div>
      )}

      {topMovers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Top movers</div>
          <div className="flex items-center gap-3 flex-wrap">
            {topMovers.map(p => (
              <div key={p.id} className="inline-flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-white">{p.symbol}</span>
                <span
                  className={`font-mono tabular-nums ${
                    (p.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {fmtUsd(p.unrealizedPnl, { signed: true, compact: true })}
                </span>
                <span className="text-[10px] text-neutral-600">· {p.exchange}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  // Use React's useId so two Sparklines on the same page don't collide
  // on `<linearGradient id=...>` (the SVG `url(#id)` resolution would
  // otherwise pick whichever instance is first in document order).
  const reactId = useId();
  const upId = `${reactId}-up`.replace(/:/g, '');
  const dnId = `${reactId}-dn`.replace(/:/g, '');

  // Render a smooth path with area-fill underneath. Full SVG, no
  // chart library — keeps the bundle clean.
  const w = 600;
  const h = 130;
  const pad = 4;
  // Defensively drop non-finite values (NaN, Infinity) before extrema —
  // a single bad row from upstream would otherwise cascade through min/max
  // and turn the whole SVG path into NaN coordinates (renders as nothing).
  const clean = data.filter(Number.isFinite);
  if (clean.length < 2) return <div className="h-32" />;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = Math.max(1, max - min);
  const stepX = (w - 2 * pad) / (clean.length - 1);
  const points = clean.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - 2 * pad) * (1 - (v - min) / range);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fill = `${path} L${points[points.length - 1][0]},${h - pad} L${points[0][0]},${h - pad} Z`;
  const stroke = positive ? '#34d399' : '#fb7185';
  const fillCol = positive ? `url(#${upId})` : `url(#${dnId})`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
      <defs>
        <linearGradient id={upId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={dnId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={fillCol} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* End point dot */}
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3} fill={stroke} />
    </svg>
  );
}

/* ── Plan & usage panel ─────────────────────────────────────────── */

function PlanUsagePanel({
  planName,
  userTier,
  isAdmin,
  watchlistCount,
  alertCount,
  watchedWalletsCount,
  exchangesConnected,
}: {
  planName: string;
  userTier: 'free' | 'trader' | 'pro' | 'whale';
  isAdmin: boolean;
  watchlistCount: number;
  alertCount: number;
  watchedWalletsCount: number;
  exchangesConnected: number;
}) {
  // Tier-driven caps. `alerts` and `watchedWallets` come from TIER_LIMITS
  // so this panel can't drift from /pricing. `watchlist` and `exchanges`
  // are dashboard-specific soft caps (not in the tier system today).
  const tierLimits = TIER_LIMITS[userTier];
  const q = {
    watchlist: isAdmin ? 500 : 50,
    alerts: Number.isFinite(tierLimits.maxAlerts) ? tierLimits.maxAlerts : 999,
    watchedWallets: Number.isFinite(tierLimits.maxWatchedWallets) ? tierLimits.maxWatchedWallets : 999,
    exchanges: isAdmin ? 10 : 4,
  };

  // Show the "Upgrade to Pro" CTA only for non-admin, non-paid users.
  const showUpgradeCta = !isAdmin && userTier === 'free';

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-hub-yellow" />
            Plan & usage
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {planName} ·{' '}
            {isAdmin
              ? 'staff · grandfathered to Whale'
              : userTier === 'free'
              ? 'no card needed · Pro free during launch'
              : 'free during launch'}
          </p>
        </div>
        <Link
          href="/profile?tab=billing"
          className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
        >
          Manage <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      <div className="space-y-3">
        <UsageBar label="Watchlist" used={watchlistCount} cap={q.watchlist} />
        <UsageBar label="Active alerts" used={alertCount} cap={q.alerts} />
        <UsageBar label="Watched wallets" used={watchedWalletsCount} cap={q.watchedWallets} />
        <UsageBar label="Connected exchanges" used={exchangesConnected} cap={q.exchanges} />
      </div>

      {showUpgradeCta && (
        <div className="mt-4 pt-3 border-t border-white/[0.04] space-y-2">
          <Link
            href="/pricing"
            className="block text-center text-xs font-semibold py-2 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all border border-emerald-400/30"
          >
            Try Pro — free during launch →
          </Link>
          <Link
            href="/invite"
            className="block text-center text-[11px] text-neutral-500 hover:text-emerald-300 transition-colors"
          >
            Or invite friends to share the upgrade →
          </Link>
        </div>
      )}
    </section>
  );
}

function UsageBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, cap)) * 100));
  const tone = pct >= 80 ? 'rose' : pct >= 60 ? 'amber' : 'emerald';
  const barColor = tone === 'rose' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-neutral-400">{label}</span>
        <span className="font-mono tabular-nums text-neutral-500">
          {used} <span className="text-neutral-700">/ {cap}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Open positions table ───────────────────────────────────────── */
// (uses Briefcase icon — Wallet would imply a balance/wallet view, not
// trading book)

function OpenPositionsTable({ positions, hasData, loading }: { positions: PositionRow[]; hasData: boolean; loading?: boolean }) {
  const top = positions.slice(0, 5);
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-hub-yellow" />
            Open positions
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {positions.length} open · live mark · synced every 60s
          </p>
        </div>
        <Link
          href="/positions"
          className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
        >
          Full book <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {loading && !hasData ? (
        // Initial fetch in flight — skeleton, not "loading…" text that
        // gets stuck if the fetch fails (positions stays null).
        <div className="space-y-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 rounded-lg border border-dashed border-white/[0.04] bg-white/[0.01] animate-pulse" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] py-8 text-center text-xs text-neutral-500">
          No open positions.{' '}
          <Link href="/profile?tab=connections" className="text-hub-yellow hover:underline">
            Connect a wallet
          </Link>{' '}
          to start tracking.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-white/[0.04]">
                <th className="text-left font-medium py-2 pr-3">Symbol</th>
                <th className="text-left font-medium py-2 pr-3">Side</th>
                <th className="text-right font-medium py-2 pr-3">Size</th>
                <th className="text-right font-medium py-2 pr-3">Entry</th>
                <th className="text-right font-medium py-2 pr-3">Mark</th>
                <th className="text-right font-medium py-2">PnL</th>
              </tr>
            </thead>
            <tbody>
              {top.map(p => (
                <tr key={p.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-3">
                    <div className="font-mono font-bold text-white">{p.symbol}</div>
                    <div className="text-[10px] text-neutral-600">{p.exchange}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        p.side === 'long'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-400/30'
                      }`}
                    >
                      {p.side}
                    </span>
                    {p.leverage != null && p.leverage > 1 && (
                      <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{p.leverage}×</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-neutral-300">
                    {p.size.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-neutral-400">
                    {fmtUsd(p.entryPrice)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
                    {fmtUsd(p.markPrice)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono tabular-nums font-bold ${
                      p.unrealizedPnl == null
                        ? 'text-neutral-500'
                        : p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {fmtUsd(p.unrealizedPnl, { signed: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Connected exchanges panel ──────────────────────────────────── */

function ConnectedExchangesPanel({
  wallets,
  keys,
  loading,
}: {
  wallets: ConnectedWallet[];
  keys: ExchangeKey[];
  loading?: boolean;
}) {
  // Roll wallets+keys into a single "venue" list by exchange/chain. Each
  // row shows: name, status (ok/error/pending), last-sync time.
  const venues = useMemo(() => buildVenuesList(wallets, keys), [wallets, keys]);
  // Real "X healthy of Y connected" — count actually-ok rows, not total.
  const healthyCount = venues.filter(v => v.status === 'ok').length;
  const totalCount = venues.length;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-hub-yellow" />
            Connected exchanges
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {totalCount === 0
              ? 'none connected'
              : `${healthyCount} healthy · ${totalCount} connected`}
          </p>
        </div>
        <Link
          href="/profile?tab=connections"
          className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
        >
          Manage <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {loading && venues.length === 0 ? (
        // Initial fetch hasn't resolved — neutral skeleton instead of the
        // "Connect one" CTA, which would flash for users who DO have
        // venues but haven't loaded them yet.
        <div className="space-y-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 rounded-lg border border-dashed border-white/[0.04] bg-white/[0.01] animate-pulse" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] py-8 text-center text-xs text-neutral-500">
          No exchanges connected.{' '}
          <Link href="/profile?tab=connections" className="text-hub-yellow hover:underline">
            Connect one
          </Link>{' '}
          to start syncing positions.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {venues.map(v => (
            <li
              key={v.key}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all"
            >
              <div
                role="img"
                aria-label={`status: ${v.status}`}
                className={`w-2 h-2 rounded-full shrink-0 ${
                  v.status === 'ok' ? 'bg-emerald-400' : v.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{v.name}</div>
                <div className="text-[10px] text-neutral-500 truncate">{v.subtitle}</div>
              </div>
              <div className="text-right shrink-0">
                {v.status === 'ok' ? (
                  <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Healthy
                  </div>
                ) : v.status === 'error' ? (
                  <div className="inline-flex items-center gap-1 text-[10px] text-rose-400">
                    <AlertCircle className="w-3 h-3" />
                    Error
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <Clock className="w-3 h-3" />
                    Pending
                  </div>
                )}
                {v.syncedAgo && (
                  <div className="text-[10px] font-mono text-neutral-600 mt-0.5">{v.syncedAgo}</div>
                )}
              </div>
            </li>
          ))}
          {/* CTA row to add another */}
          <li>
            <Link
              href="/profile?tab=connections"
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-dashed border-white/[0.06] hover:border-hub-yellow/40 hover:bg-hub-yellow/5 transition-all text-xs text-neutral-500 hover:text-hub-yellow"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect another venue
              <ExternalLink className="w-3 h-3 ml-auto" />
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Pure helpers (deterministic, no I/O)                              */
/* ────────────────────────────────────────────────────────────────── */

interface StreakInputs {
  notifications: Array<{ sentAt: string }>;
  positions: Array<{ updatedAt?: string }>;
  events: Array<{ ts: string }>;
}
function computeStreak(inp: StreakInputs): number {
  // Build a Set of LOCAL date keys ("YYYY-MM-DD") where ANY signal was
  // recorded, then walk backward from today. Local dates (not UTC) so
  // a user in Tokyo at 11am with activity from yesterday 11pm sees a
  // streak — UTC keying would have placed those in different days.
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const days = new Set<string>();
  const add = (ts: string | undefined) => {
    if (!ts) return;
    const t = new Date(ts);
    if (Number.isNaN(t.getTime())) return;
    days.add(localKey(t));
  };
  inp.notifications.forEach(n => add(n.sentAt));
  inp.positions.forEach(p => add(p.updatedAt));
  inp.events.forEach(e => add(e.ts));

  let streak = 0;
  const cursor = new Date();
  // Walk backward up to 365 days; cap at first gap.
  for (let i = 0; i < 365; i++) {
    if (days.has(localKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      // No signal today — return 0 rather than yesterday's count, mirrors
      // how Duolingo displays "0-day streak" until you've done today.
      return 0;
    } else {
      break;
    }
  }
  return streak;
}

interface BriefInputs {
  name: string;
  equity: number;
  openUnrealized: number;
  notifFired: number;
  eventsLast24h: number;
  watchedCount: number;
  positions: Array<{ symbol: string; unrealizedPnl: number | null }>;
}
function buildMorningBrief(inp: BriefInputs): string[] {
  const lines: string[] = [];
  // Hour-of-day greeting
  const h = new Date().getHours();
  const greet = h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  lines.push(`${greet}, ${inp.name}.`);

  if (inp.equity > 0) {
    const pnlPct = (inp.openUnrealized / inp.equity) * 100;
    if (Math.abs(pnlPct) >= 0.1) {
      lines.push(
        // Sign is communicated via the up/down word — don't ALSO put a "+"
        // inside the parens (fmtPct would prepend "+" to the abs value,
        // producing "Book is down $500 (+2.34%)" which contradicts itself).
        `Book is ${inp.openUnrealized >= 0 ? 'up' : 'down'} ${fmtUsd(Math.abs(inp.openUnrealized), { compact: true })} (${Math.abs(pnlPct).toFixed(2)}%) on open positions.`,
      );
    } else {
      lines.push('Book is roughly flat on open positions.');
    }
  }

  if (inp.notifFired > 0) {
    lines.push(`${inp.notifFired} alert${inp.notifFired === 1 ? '' : 's'} fired recently.`);
  }

  if (inp.watchedCount > 0 && inp.eventsLast24h > 0) {
    lines.push(
      `${inp.eventsLast24h} new event${inp.eventsLast24h === 1 ? '' : 's'} from your ${inp.watchedCount} watched wallet${inp.watchedCount === 1 ? '' : 's'}.`,
    );
  }

  // Biggest mover
  const sorted = [...inp.positions]
    .filter(p => p.unrealizedPnl != null)
    .sort((a, b) => Math.abs(b.unrealizedPnl ?? 0) - Math.abs(a.unrealizedPnl ?? 0));
  const top = sorted[0];
  if (top && top.unrealizedPnl != null && Math.abs(top.unrealizedPnl) > 1) {
    lines.push(
      `Biggest mover is ${top.symbol} at ${fmtUsd(top.unrealizedPnl, { compact: true, signed: true })}.`,
    );
  }

  // Fallback if nothing else to say
  if (lines.length === 1) {
    lines.push('Quiet across the book — markets are calm and no alerts have fired.');
  }
  return lines.slice(0, 4);
}

interface VenueRow {
  key: string;
  name: string;
  subtitle: string;
  status: 'ok' | 'error' | 'pending';
  /** Real time-since-last-sync string. Null for wallets (read-only,
   *  no sync state in DB). */
  syncedAgo: string | null;
}
function buildVenuesList(wallets: ConnectedWallet[], keys: ExchangeKey[]): VenueRow[] {
  const out: VenueRow[] = [];
  // Wallets first — chain becomes the venue. Wallets are read-only
  // (we hit the chain RPC on demand), so no last-sync field exists.
  for (const w of wallets) {
    const chainName = w.chain.charAt(0).toUpperCase() + w.chain.slice(1);
    out.push({
      key: `w:${w.id}`,
      name: w.label || chainName,
      subtitle: shortAddr(w.address) + ' · ' + chainName,
      status: 'ok',
      syncedAgo: null, // wallets don't have a sync state — fetched on demand
    });
  }
  // Exchange keys — real status from sync-positions cron
  for (const k of keys) {
    const status: 'ok' | 'error' | 'pending' = k.lastError
      ? 'error'
      : k.lastSyncedAt
        ? 'ok'
        : 'pending';
    out.push({
      key: `k:${k.id}`,
      name: k.label || k.exchange,
      subtitle: k.lastSyncedAt
        ? `Synced ${relTime(k.lastSyncedAt)}`
        : k.lastError
          ? k.lastError.slice(0, 40)
          : 'Awaiting first sync',
      status,
      syncedAgo: k.lastSyncedAt ? relTime(k.lastSyncedAt) : null,
    });
  }
  return out;
}
