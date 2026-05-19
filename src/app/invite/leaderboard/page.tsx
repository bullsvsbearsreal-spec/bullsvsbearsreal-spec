'use client';

/**
 * /invite/leaderboard — public top-20 referrer ranking.
 *
 * Anonymized: shows only the first 4 chars of each invite code. Gives
 * sharers a visible social-proof carrot ("there's a leaderboard, the
 * top spots are real people") without leaking who's behind each code.
 *
 * Data: /api/invite/leaderboard (5min L1 + 5min CF s-maxage). Refresh
 * by reloading — no manual refresh button because there's nothing the
 * user can do to change their position in 5 minutes that the cache
 * wouldn't already reflect.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { tweetIntent, telegramShareIntent } from '@/lib/tweetIntent';
import { Trophy, Send, ArrowRight, TrendingUp, Twitter, MessageSquare } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  codePrefix: string;
  signups: number;
  verified: number;
}

interface LeaderboardResp {
  generatedAt: string;
  topN: number;
  entries: LeaderboardEntry[];
}

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-mono font-bold text-neutral-500 bg-white/[0.04]">
        {rank}
      </span>
    );
  }
  const tones = ['text-amber-300 bg-amber-500/[0.12] border-amber-400/30', // gold
                 'text-neutral-300 bg-neutral-500/[0.12] border-neutral-400/30', // silver
                 'text-orange-400 bg-orange-500/[0.12] border-orange-400/30']; // bronze
  const tone = tones[rank - 1];
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[11px] font-bold ${tone}`}>
      {rank}
    </span>
  );
}

export default function InviteLeaderboardPage() {
  const { status } = useSession();
  const [data, setData] = useState<LeaderboardResp | null>(null);
  const [myCodePrefix, setMyCodePrefix] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Pull leaderboard always; pull my-stats only if signed in
        // (so logged-out visitors don't burn an auth round-trip).
        const isAuthed = status === 'authenticated';
        const promises: Promise<Response>[] = [fetch('/api/invite/leaderboard')];
        if (isAuthed) promises.push(fetch('/api/invite/stats'));
        const [lbRes, myRes] = await Promise.all(promises);

        if (cancelled) return;
        const lbJson = await lbRes.json();
        if (!lbRes.ok) {
          setError('Could not load the leaderboard. Try refreshing.');
        } else {
          setData(lbJson);
        }
        if (myRes && myRes.ok) {
          const myJson = await myRes.json();
          // First 4 chars of MY code — same prefix the leaderboard
          // entries use. If MY entry is in the top 20 we'll highlight it.
          if (typeof myJson?.code === 'string') {
            setMyCodePrefix(myJson.code.slice(0, 4));
          }
        }
      } catch {
        if (!cancelled) setError('Network error — could not reach the server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  const entries = data?.entries ?? [];
  const myEntry = myCodePrefix
    ? entries.find((e) => e.codePrefix === myCodePrefix) ?? null
    : null;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 sm:px-6 py-6">
        <PageHero
          icon={Trophy}
          eyebrow="Top referrers"
          title="Invite"
          accentNoun="leaderboard"
          accent="emerald"
          description={
            <>
              Top 20 InfoHub users by verified referrals. Anonymized — entries
              show only the first 4 chars of each invite code. Want to climb?{' '}
              <Link href="/invite" className="text-emerald-300 hover:underline font-medium">
                Grab your link
              </Link>
              .
            </>
          }
        />

        {error && (
          <div className="card-premium p-3 mb-4 border border-amber-400/30 bg-amber-500/5 text-[12px] text-amber-300">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )}

        {data && entries.length === 0 && (
          <div className="card-premium p-8 text-center">
            <Trophy className="w-10 h-10 text-emerald-400/60 mx-auto mb-3" />
            <h2 className="text-base font-bold text-white mb-1">Leaderboard is empty</h2>
            <p className="text-[12px] text-neutral-400 max-w-sm mx-auto mb-4">
              Nobody has been referred yet. Be the first — share your link and
              you&apos;re guaranteed the #1 spot at first verification.
            </p>
            <Link
              href="/invite"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Get your link
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* 'You are here' callout when signed-in user appears on the
            board — gives them an at-a-glance confirmation + a path to
            share their rank. */}
        {myEntry && (() => {
          // Pre-build the share templates. Includes the rank as social
          // proof (people are more likely to retweet a "I'm #3 on X"
          // post than a generic "check out X" one).
          const tweetText = `I'm ranked #${myEntry.rank} on the InfoHub referral leaderboard with ${myEntry.verified} verified referrals. derivatives terminal across every venue, free tier covers basically everything: https://info-hub.io/invite`;
          const tweetUrl = tweetIntent({ text: tweetText });
          // Telegram is the most-used channel in crypto — pair the
          // tweet button with it so users can share to whichever
          // platform their audience actually lives on.
          const tgText = `I'm ranked #${myEntry.rank} on the InfoHub referral leaderboard with ${myEntry.verified} verified referrals. Real-time derivatives terminal — free tier covers almost everything.`;
          const tgUrl = telegramShareIntent({ url: 'https://info-hub.io/invite', text: tgText });
          return (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.05] px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
              <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-emerald-300">
                  You&apos;re ranked #{myEntry.rank} on the leaderboard
                </div>
                <div className="text-xs text-neutral-400">
                  {myEntry.verified} verified · {myEntry.signups} signups via your link
                </div>
              </div>
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 px-3 py-1.5 rounded-lg border border-sky-400/40 bg-sky-500/[0.05] hover:bg-sky-500/[0.1]"
                aria-label="Share rank on X (Twitter)"
              >
                <Twitter className="w-3.5 h-3.5" />
                Tweet rank
              </a>
              <a
                href={tgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 px-3 py-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/[0.05] hover:bg-cyan-500/[0.1]"
                aria-label="Share rank on Telegram"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Telegram
              </a>
              <Link
                href="/invite"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-400/40 hover:bg-emerald-500/10"
              >
                Share link <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          );
        })()}

        {entries.length > 0 && (
          <>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-3">
              <div className="grid grid-cols-[40px_1fr_80px_80px] gap-2 px-4 py-2 border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                <div>#</div>
                <div>Code</div>
                <div className="text-right">Sign-ups</div>
                <div className="text-right">Verified</div>
              </div>
              {entries.map((e) => {
                const isMe = myEntry?.codePrefix === e.codePrefix;
                return (
                  <div
                    key={e.codePrefix}
                    className={`grid grid-cols-[40px_1fr_80px_80px] gap-2 items-center px-4 py-3 border-b border-white/[0.04] transition-colors ${
                      isMe
                        ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.08]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <MedalIcon rank={e.rank} />
                    <div className="font-mono text-[13px] text-neutral-300 tracking-wider inline-flex items-center gap-2">
                      {e.codePrefix}<span className="text-neutral-600">******</span>
                      {isMe && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                          you
                        </span>
                      )}
                    </div>
                    <div className="text-right font-mono tabular-nums text-[13px] text-white">
                      {e.signups.toLocaleString()}
                    </div>
                    <div className="text-right font-mono tabular-nums text-[13px] text-emerald-300 inline-flex items-center justify-end gap-1">
                      <TrendingUp className="w-3 h-3 opacity-50" />
                      {e.verified.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
            {data?.generatedAt && (
              <p className="text-[10px] text-neutral-600 font-mono text-right mb-6">
                Generated {fmtAge(data.generatedAt)} · cached 5 min
              </p>
            )}
          </>
        )}

        {/* CTA card */}
        <section className="card-premium p-5 mb-8 border border-emerald-400/15 bg-emerald-500/[0.02] text-center">
          <Trophy className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-white mb-1">Want to climb?</h2>
          <p className="text-[12px] text-neutral-400 mb-4 max-w-md mx-auto">
            Every friend who signs up through your link counts. Verified
            accounts move you up the ranking faster than unverified ones.
          </p>
          <Link
            href="/invite"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Get your invite link
            <ArrowRight className="w-3 h-3" />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
