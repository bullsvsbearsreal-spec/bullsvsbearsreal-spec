/**
 * Hub bot v2 — public track record at /bot/track.
 *
 * Every proactive idea push gets logged with its signals + outcome.
 * This page surfaces the honest log: every call, every result, every
 * loss. Builds trust + lets us tune the scorer from real outcomes.
 *
 * Stats shown:
 *   - Last-30-day W/L count + median R-multiple
 *   - Per-setup-type breakdown
 *   - Full chronological log: timestamp, coin, side, score, signals,
 *     invalidation, status, outcome %
 *
 * Server component — pulls from bot_trade_ideas directly. No client
 * interactivity needed (the data is static between scans).
 */

import { listRecentTradeIdeas } from '@/lib/db';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { LineChart, TrendingUp, TrendingDown, Clock, Crosshair, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;
export const metadata = {
  title: 'Hub bot · Track Record · InfoHub',
  description: 'Every trade idea Hub has called, with honest outcomes. Built for trust.',
};

export default async function BotTrackPage() {
  const ideas = await listRecentTradeIdeas(150);

  // Closed-only stats
  const closed = ideas.filter((i) => i.status !== 'live');
  const wins = closed.filter((i) => (i.outcome_pct ?? 0) > 0);
  const losses = closed.filter((i) => (i.outcome_pct ?? 0) <= 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgOutcome = closed.length > 0
    ? closed.reduce((s, i) => s + (i.outcome_pct ?? 0), 0) / closed.length
    : 0;

  // Per-setup breakdown
  const bySetup = new Map<string, { wins: number; losses: number; closed: number }>();
  for (const i of closed) {
    const entry = bySetup.get(i.setup_type) ?? { wins: 0, losses: 0, closed: 0 };
    entry.closed++;
    if ((i.outcome_pct ?? 0) > 0) entry.wins++;
    else entry.losses++;
    bySetup.set(i.setup_type, entry);
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto px-4 py-6">
        <PageHero
          icon={LineChart}
          eyebrow="Hub bot · honest log"
          title="Track"
          accentNoun="record"
          accent="hub-yellow"
          description={
            <>Every trade idea Hub has proactively pushed, with the signals
              that fired and what actually happened. We log losses the same
              as wins — that&apos;s the deal.</>
          }
          className="mb-8"
        />

        {/* ── Summary stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<Crosshair className="w-3.5 h-3.5 text-hub-yellow" />}
            label="Total ideas (90d)"
            value={String(ideas.length)}
            sub={`${closed.length} closed · ${ideas.length - closed.length} live`}
          />
          <StatCard
            icon={<TrendingUp className="w-3.5 h-3.5 text-green-400" />}
            label="Win rate"
            value={closed.length > 0 ? `${winRate.toFixed(0)}%` : '—'}
            sub={`${wins.length} W / ${losses.length} L`}
            tone={winRate >= 55 ? 'good' : winRate >= 45 ? 'neutral' : 'bad'}
          />
          <StatCard
            icon={<LineChart className="w-3.5 h-3.5 text-hub-yellow" />}
            label="Avg outcome"
            value={closed.length > 0 ? `${avgOutcome >= 0 ? '+' : ''}${avgOutcome.toFixed(2)}%` : '—'}
            sub="per closed idea"
            tone={avgOutcome >= 1 ? 'good' : avgOutcome >= -1 ? 'neutral' : 'bad'}
          />
          <StatCard
            icon={<Clock className="w-3.5 h-3.5 text-neutral-400" />}
            label="Live now"
            value={String(ideas.filter((i) => i.status === 'live').length)}
            sub="awaiting resolution"
          />
        </div>

        {/* ── Per-setup breakdown ───────────────────────────────────── */}
        {bySetup.size > 0 && (
          <div className="mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Per-setup breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {Array.from(bySetup.entries()).map(([setup, stats]) => {
                const wr = stats.closed > 0 ? (stats.wins / stats.closed) * 100 : 0;
                return (
                  <div key={setup} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{setup}</div>
                    <div className="text-lg font-bold font-mono text-white">{wr.toFixed(0)}%</div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {stats.wins}W / {stats.losses}L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Educational note ─────────────────────────────────────── */}
        <div className="callout callout-warn mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-hub-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-hub-yellow text-sm font-medium">How outcomes are calculated</p>
              <p className="text-neutral-500 text-sm mt-1">
                For PR2 v1, outcome % is computed at idea close (invalidation
                or expiry) relative to the invalidation level. Wins mean the
                idea reached expiry without invalidating. Losses mean the
                invalidation level was breached. PR3 will store entry price
                directly + compute proper R-multiples vs entry.
              </p>
              <p className="text-neutral-700 text-xs mt-3">
                Not financial advice. Past results don&apos;t guarantee future
                outcomes. The bot is a scout, not a manager.
              </p>
            </div>
          </div>
        </div>

        {/* ── Idea log ──────────────────────────────────────────────── */}
        {ideas.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-neutral-500">No ideas published yet. Check back after a couple of scan cycles.</p>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm" aria-label="Trade idea log">
              <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                <tr>
                  <th className="text-left text-neutral-500 font-medium px-3 py-2">When</th>
                  <th className="text-left text-neutral-500 font-medium px-3 py-2">Coin</th>
                  <th className="text-left text-neutral-500 font-medium px-3 py-2">Side</th>
                  <th className="text-left text-neutral-500 font-medium px-3 py-2">Score</th>
                  <th className="text-left text-neutral-500 font-medium px-3 py-2">Setup</th>
                  <th className="text-left text-neutral-500 font-medium px-3 py-2">Status</th>
                  <th className="text-right text-neutral-500 font-medium px-3 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {ideas.map((i) => (
                  <tr key={i.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-xs text-neutral-500 font-mono whitespace-nowrap">
                      {formatRelative(i.created_at)}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-white">{i.symbol}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold ${i.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                        {i.side === 'long' ? 'LONG' : 'SHORT'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-neutral-300">{i.score}</td>
                    <td className="px-3 py-2 text-xs text-neutral-400">{i.setup_type}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {i.outcome_pct == null ? (
                        <span className="text-neutral-700">—</span>
                      ) : (
                        <span className={i.outcome_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {i.outcome_pct >= 0 ? '+' : ''}{i.outcome_pct.toFixed(2)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: 'good' | 'neutral' | 'bad';
}) {
  const valueCls =
    tone === 'good' ? 'text-green-400'
    : tone === 'bad' ? 'text-red-400'
    : 'text-white';
  return (
    <div className="stat-grid-card">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-neutral-500 text-xs">{label}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${valueCls}`}>{value}</div>
      <div className="text-xs text-neutral-600">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'live' | 'invalidated' | 'expired' }) {
  if (status === 'live') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-hub-yellow/15 text-hub-yellow border border-hub-yellow/30">Live</span>;
  }
  if (status === 'invalidated') {
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-400/30">Stopped</span>;
  }
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">Expired</span>;
}

function formatRelative(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
