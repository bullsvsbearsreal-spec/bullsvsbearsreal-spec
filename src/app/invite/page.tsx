'use client';

/**
 * /invite — user-to-user referral page.
 *
 * Distinct from /referrals (exchange affiliates). This is the page a
 * signed-in user lands on to grab their personal share link, copy
 * pre-written tweet / message templates, and see how many friends
 * have signed up through them.
 *
 * Counts come from /api/invite/stats (auth-required). The page hero
 * uses the shared PageHero design-system component (emerald accent,
 * "growth / positive" tone).
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import {
  Send, Copy, Check, ExternalLink, Twitter, MessageCircle,
  TrendingUp, Users, Gift, Lock, MessageSquare,
} from 'lucide-react';

interface InviteStats {
  code: string;
  shareUrl: string;
  signups: number;
  verified: number;
  degraded?: boolean;
  error?: string;
}

function CopyButton({
  value,
  label = 'Copy',
  className = '',
}: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* fallback: select-and-prompt is not worth the complexity */ }
  }, [value]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? 'Copied to clipboard' : `Copy ${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
        copied
          ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-300'
          : 'bg-hub-yellow text-black hover:bg-hub-yellow/90'
      } ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function InvitePage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/invite/stats');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || 'Could not load your invite link.');
        } else {
          setStats(data);
        }
      } catch {
        if (!cancelled) setError('Network error — could not reach the server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  /* ── Unauthenticated state ─────────────────────────────────── */

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main id="main-content" className="max-w-[640px] mx-auto w-full px-4 py-16">
          <div className="card-premium p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/[0.12] border border-emerald-400/30 flex items-center justify-center">
              <Lock className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-white mb-2">Sign in to grab your invite link</h1>
            <p className="text-sm text-neutral-400 mb-5 max-w-md mx-auto leading-relaxed">
              Your invite link is unique to your account. Sign in to see it and start
              referring friends.
            </p>
            <div className="inline-flex gap-2 flex-wrap justify-center">
              <Link
                href="/login?callbackUrl=/invite"
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup?callbackUrl=/invite"
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded bg-transparent border border-white/[0.08] text-neutral-400 hover:text-white transition-colors"
              >
                Create account
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ── Loading / unknown session state ───────────────────────── */

  if (status === 'loading' || (loading && !stats)) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 sm:px-6 py-6">
          <div className="h-32 rounded-xl bg-white/[0.03] animate-pulse mb-4" />
          <div className="h-48 rounded-xl bg-white/[0.03] animate-pulse" />
        </main>
        <Footer />
      </div>
    );
  }

  /* ── Authenticated state ───────────────────────────────────── */

  const code = stats?.code ?? '—';
  const shareUrl = stats?.shareUrl ?? '';
  const signups = stats?.signups ?? 0;
  const verified = stats?.verified ?? 0;
  const displayName = session?.user?.name || session?.user?.email?.split('@')[0] || 'a friend';

  // Pre-written share copy. Specific enough that it doesn't read like
  // generic-influencer ad copy; vague enough that anyone can ship it.
  const tweetText = `Been using InfoHub for crypto derivatives data — funding rates, OI, liq levels, all on one terminal. Free tier covers basically everything. Sign up here: ${shareUrl}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const dmText = `Hey — I've been using InfoHub for funding rates, OI, and liq data lately. Worth a look:\n${shareUrl}`;

  // Telegram share — same body as the DM template since it goes into a
  // chat context. ?url and ?text are concatenated by Telegram into one
  // message preview.
  const telegramShareText = `Been using InfoHub — derivatives terminal with funding rates, OI, and liq data across every venue. Free tier covers basically everything.`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(telegramShareText)}`;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 sm:px-6 py-6">
        <PageHero
          icon={Send}
          eyebrow="My tools"
          title="Invite"
          accentNoun="friends"
          accent="emerald"
          description={
            <>
              Share your personal link. Every friend who signs up through it is
              counted below — and you both get on the early-access list for
              upcoming team features.
            </>
          }
        />

        {error && (
          <div className="card-premium p-3 mb-4 border border-amber-400/30 bg-amber-500/5 text-[12px] text-amber-300">
            {error} — your share link is still shown below.
          </div>
        )}

        {/* ── Share link card ────────────────────────────────── */}
        <section className="card-premium p-5 mb-5">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="inline-flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Your share link</h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500">
              code · {code}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="flex-1 min-w-0 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 font-mono text-[12px] sm:text-[13px] text-neutral-200 truncate">
              {shareUrl || '—'}
            </div>
            <CopyButton value={shareUrl} label="Copy link" />
          </div>
          <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
            Anyone who signs up through this URL is attributed to you. The code
            is stable — bookmark this page and share the same link forever.
          </p>
        </section>

        {/* ── Stats strip ────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 mb-5">
          <div className="card-premium p-4">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1 inline-flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Sign-ups
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-white">
              {signups}
            </div>
            <div className="text-[10px] text-neutral-600 mt-1">
              total friends who used your link
            </div>
          </div>
          <div className="card-premium p-4">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold mb-1 inline-flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Verified
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-emerald-300">
              {verified}
            </div>
            <div className="text-[10px] text-neutral-600 mt-1">
              completed email verification
            </div>
          </div>
        </section>

        {/* ── Share templates ────────────────────────────────── */}
        <section className="card-premium p-5 mb-5">
          <h2 className="text-sm font-bold text-white mb-1 inline-flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            Share templates
          </h2>
          <p className="text-[11px] text-neutral-500 mb-4">
            One-click share targets. Edit the wording before posting — generic copy
            performs worse than your own voice.
          </p>

          <div className="space-y-3">
            {/* Tweet */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Twitter className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                  Tweet
                </span>
              </div>
              <p className="text-[12px] text-neutral-300 leading-relaxed mb-3 break-words">
                {tweetText}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-300 hover:bg-sky-500/25 transition-colors"
                >
                  <Twitter className="w-3.5 h-3.5" />
                  Post to X
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
                <CopyButton value={tweetText} label="Copy text" className="!bg-white/[0.06] !text-neutral-300 hover:!bg-white/[0.1]" />
              </div>
            </div>

            {/* DM / Discord */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                  DM / Discord
                </span>
              </div>
              <pre className="text-[12px] text-neutral-300 leading-relaxed mb-3 whitespace-pre-wrap font-sans">
                {dmText}
              </pre>
              <CopyButton value={dmText} label="Copy text" className="!bg-white/[0.06] !text-neutral-300 hover:!bg-white/[0.1]" />
            </div>

            {/* Telegram — most crypto-native channel; one click opens
                Telegram's share dialog with the link + caption pre-filled. */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                  Telegram
                </span>
              </div>
              <p className="text-[12px] text-neutral-300 leading-relaxed mb-3 break-words">
                {telegramShareText}{' '}
                <span className="text-cyan-300/80 underline-offset-2 break-all">{shareUrl}</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Open Telegram share
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
                <CopyButton value={`${telegramShareText} ${shareUrl}`} label="Copy text" className="!bg-white/[0.06] !text-neutral-300 hover:!bg-white/[0.1]" />
              </div>
            </div>
          </div>
        </section>

        {/* ── What's next ────────────────────────────────────── */}
        <section className="card-premium p-5 mb-8 border border-emerald-400/15 bg-emerald-500/[0.02]">
          <h2 className="text-sm font-bold text-white mb-1 inline-flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            What you both get
          </h2>
          <ul className="text-[12px] text-neutral-400 leading-relaxed space-y-1.5 mt-2 list-disc list-inside marker:text-emerald-400/40">
            <li>Early access to upcoming tier features (Pro API, advanced alerts)</li>
            <li>Priority on the new-feature feedback loop</li>
            <li>A spot on the InfoHub team referral leaderboard (launching soon)</li>
          </ul>
          <p className="text-[11px] text-neutral-500 mt-3">
            Welcome, <span className="text-white font-medium">{displayName}</span> — your code{' '}
            <span className="font-mono text-emerald-300">{code}</span> stays the same forever, so
            you can bookmark this page and come back to share the link any time.
          </p>
        </section>

        {/* ── Footer links ────────────────────────────────────── */}
        <div className="text-[11px] text-neutral-500 text-center mb-8 space-y-1">
          <p>
            See who&apos;s climbing the rankings →{' '}
            <Link href="/invite/leaderboard" className="text-emerald-300 hover:underline">
              referral leaderboard
            </Link>
          </p>
          <p>
            Looking for exchange affiliate links instead?{' '}
            <Link href="/referrals" className="text-hub-yellow hover:underline">
              See the partner referrals page →
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
