import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Trophy, ArrowRight, DollarSign, Users, Sparkles } from 'lucide-react';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

// Page-specific title/description — previously the page fell through to
// the site default ("InfoHub | Real-Time Crypto Derivatives Dashboard")
// which is generic and bad for SEO + share previews. This page is the
// public affiliate leaderboard; it deserves its own social card title.
export const metadata: Metadata = {
  title: 'Affiliate Leaderboard',
  description: 'Top earning InfoHub affiliates. Public ranking by USDT paid out + pending commission. 20% recurring lifetime on every paid signup.',
  alternates: { canonical: 'https://info-hub.io/leaderboard' },
  openGraph: {
    title: 'Affiliate Leaderboard · InfoHub',
    description: 'Top earning InfoHub affiliates — 20% recurring lifetime, USDT payouts.',
    url: 'https://info-hub.io/leaderboard',
  },
};

/* ───────────────────────────────────────────────────────────────────────
 * /leaderboard — PUBLIC affiliate referral ranking.
 *
 * Source: /api/leaderboard (cached server route, revalidate=60s).
 * No auth required. Anonymous browsing welcome.
 *
 * Identity: shows user.name if the affiliate has set one, otherwise a
 * stable 'Affiliate #1234' synth handle (hashed from user id — same
 * across windows). No email, no id, no referral code leaked.
 *
 * Columns:
 *   Rank · Affiliate · Earned (paid USDT) · Pending (confirmed not paid)
 *   · Signups · Conversions
 *
 * Window tabs: all-time / 30d / 7d via ?window=
 *
 * If the visitor is logged in and is past rank 100 (or off the public
 * top entirely), a sticky footer surfaces their own row with the same
 * privacy treatment.
 * ─────────────────────────────────────────────────────────────────── */

export const dynamic = 'force-dynamic';

const WINDOW_TABS = [
  { id: 'all', label: 'All-time' },
  { id: '30d', label: 'Last 30d' },
  { id: '7d',  label: 'Last 7d' },
] as const;

type WindowId = typeof WINDOW_TABS[number]['id'];

interface LeaderRow {
  rank: number;
  displayName: string;
  isNamed: boolean;
  earned: number;
  pending: number;
  signups: number;
  conversions: number;
}

interface ApiResponse {
  window: WindowId;
  updatedAt: string;
  rows: LeaderRow[];
  yours?: LeaderRow | null;
  error?: string;
}

function fmtUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
}

async function fetchBoard(window: WindowId): Promise<ApiResponse> {
  // Resolve absolute origin so this works whether we're on Vercel,
  // DigitalOcean App Platform, or local. The same-server fetch is fast
  // because Next dedupes it through its cache.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/api/leaderboard?window=${window}`;
  try {
    const res = await fetch(url, {
      // We also forward the Cookie header so the API can identify the
      // viewer for "your rank" without exposing the user's session beyond
      // our own server boundary.
      headers: { cookie: h.get('cookie') ?? '' },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return { window, updatedAt: new Date().toISOString(), rows: [] };
    }
    return await res.json();
  } catch {
    return { window, updatedAt: new Date().toISOString(), rows: [] };
  }
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const window: WindowId =
    sp.window === '30d' || sp.window === '7d' ? sp.window : 'all';
  const board = await fetchBoard(window);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1100px] mx-auto px-4 sm:px-6 pb-32">
        {/* ─── Hero ─── */}
        <section className="relative py-10 sm:py-14 text-center overflow-hidden">
          <div className="absolute inset-0 hero-mesh opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/25 text-amber-300 text-xs font-semibold mb-5">
              <Trophy className="w-3.5 h-3.5" />
              Affiliate Leaderboard
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">
              Top <span className="text-gradient">affiliates</span> by earnings
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-1">
              Every paid signup pays 20% recurring forever. Here&apos;s who&apos;s
              earning what.
            </p>
            <p className="text-neutral-500 text-xs sm:text-sm max-w-xl mx-auto">
              Want in?{' '}
              <Link href="/referrals" className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline">
                Read the program terms
              </Link>{' '}
              or{' '}
              <Link href="/settings/referrals" className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline">
                grab your referral link
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ─── Window tabs ─── */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {WINDOW_TABS.map(t => {
            const active = window === t.id;
            return (
              <Link
                key={t.id}
                href={t.id === 'all' ? '/leaderboard' : `/leaderboard?window=${t.id}`}
                replace
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                    : 'bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* ─── Leaderboard table ─── */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[60px_1fr_110px_110px_90px_90px] sm:grid-cols-[60px_1fr_120px_120px_100px_100px] gap-2 px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.05]">
            <div>Rank</div>
            <div>Affiliate</div>
            <div className="text-right">Earned</div>
            <div className="text-right">Pending</div>
            <div className="text-right hidden sm:block">Signups</div>
            <div className="text-right">Convs</div>
            <div className="text-right sm:hidden">Sign·Conv</div>
          </div>

          {board.rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-neutral-500">
              <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No affiliate activity yet for this window.
              <div className="mt-1 text-xs text-neutral-600">Be the first — share your link.</div>
            </div>
          ) : (
            <ol className="divide-y divide-white/[0.04]">
              {board.rows.map(r => (
                <LeaderRowItem key={r.rank} row={r} />
              ))}
            </ol>
          )}

          {/* Footer note */}
          <div className="px-4 py-2.5 text-[10px] text-neutral-600 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-2">
            <span>
              Updated {fmtAgoSafe(board.updatedAt)} · refreshes every minute · top {board.rows.length}
            </span>
            <span>
              <span className="text-neutral-500">Earned</span> = USDT paid ·{' '}
              <span className="text-neutral-500">Pending</span> = confirmed unpaid
            </span>
          </div>
        </section>

        {/* ─── Call to action ─── */}
        <section className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CtaCard
            icon={DollarSign}
            title="20% recurring lifetime"
            body="Every paid month they pay, you earn 20% — forever, no claw-back."
          />
          <CtaCard
            icon={Users}
            title="90-day cookie"
            body="Even if they don't sign up the same day, you still get the attribution for 90 days."
          />
          <CtaCard
            icon={Sparkles}
            title="USDT to your wallet"
            body="Solana / Arbitrum / Base. $25 minimum, paid monthly."
          />
        </section>

        <div className="text-center mt-8">
          <Link
            href="/settings/referrals"
            className="group inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
          >
            Get my referral link
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </main>

      {/* ─── Sticky "your rank" footer ─── */}
      {board.yours && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-amber-500/[0.06] backdrop-blur-md border-t border-amber-400/20">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono tabular-nums text-amber-200 font-bold whitespace-nowrap">
                You · #{board.yours.rank}
              </span>
              <span className="text-neutral-400 truncate hidden sm:block">{board.yours.displayName}</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 whitespace-nowrap">
              <span><span className="text-neutral-500">Earned</span> <span className="font-mono tabular-nums text-emerald-300 font-semibold">{fmtUSD(board.yours.earned)}</span></span>
              <span><span className="text-neutral-500">Pending</span> <span className="font-mono tabular-nums text-amber-300 font-semibold">{fmtUSD(board.yours.pending)}</span></span>
              <span className="hidden sm:inline"><span className="text-neutral-500">Convs</span> <span className="font-mono tabular-nums text-white">{board.yours.conversions}</span></span>
              <Link
                href="/settings/referrals"
                className="text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline"
              >
                Boost &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

/* ── Row component ──────────────────────────────────────────────────── */

function LeaderRowItem({ row }: { row: LeaderRow }) {
  const isTop3 = row.rank <= 3;
  const rankColor =
    row.rank === 1 ? 'text-yellow-300' :
    row.rank === 2 ? 'text-neutral-300' :
    row.rank === 3 ? 'text-amber-700' :
    'text-neutral-500';

  return (
    <li className="grid grid-cols-[60px_1fr_110px_110px_90px_90px] sm:grid-cols-[60px_1fr_120px_120px_100px_100px] gap-2 px-4 py-2.5 items-center text-xs hover:bg-white/[0.02] transition-colors">
      <div className={`font-mono tabular-nums font-bold text-base sm:text-lg ${rankColor}`}>
        {isTop3 ? <span aria-hidden>{['🥇','🥈','🥉'][row.rank - 1]}</span> : `#${row.rank}`}
      </div>
      <div className="min-w-0">
        <div className={`font-semibold truncate ${row.isNamed ? 'text-white' : 'text-neutral-400'}`}>
          {row.displayName}
        </div>
        {!row.isNamed && (
          <div className="text-[10px] text-neutral-600">anonymous</div>
        )}
      </div>
      <div className="text-right font-mono tabular-nums font-semibold text-emerald-300">
        {fmtUSD(row.earned)}
      </div>
      <div className="text-right font-mono tabular-nums font-semibold text-amber-300/90">
        {fmtUSD(row.pending)}
      </div>
      <div className="text-right font-mono tabular-nums text-neutral-300 hidden sm:block">{row.signups}</div>
      <div className="text-right font-mono tabular-nums text-neutral-300 hidden sm:block">{row.conversions}</div>
      {/* Mobile: signups · convs collapsed */}
      <div className="text-right font-mono tabular-nums text-neutral-400 sm:hidden text-[11px]">
        {row.signups}<span className="text-neutral-700 mx-1">·</span>{row.conversions}
      </div>
    </li>
  );
}

function CtaCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-amber-300" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}

function fmtAgoSafe(iso: string): string {
  try {
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    if (ms < 60_000) return 'just now';
    const m = Math.floor(ms / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return '—';
  }
}
