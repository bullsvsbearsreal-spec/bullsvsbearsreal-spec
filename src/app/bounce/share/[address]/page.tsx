'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApi } from '@/hooks/useSWRApi';
import { Flame, ArrowLeft, Copy, CheckCircle2, Download, ExternalLink, Info } from 'lucide-react';

interface ProfileResponse {
  address: string;
  score: number;
  rank: number | null;
  totalNotional: number;
  count: number;
  topPercent: number;
  meta: { bounceProfileUrl: string };
}

function short(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function BounceSharePage() {
  const params = useParams<{ address: string }>();
  const address = (params?.address || '').toLowerCase();

  const [copied, setCopied] = useState<'link' | 'tweet' | null>(null);

  const { data, isLoading } = useApi<ProfileResponse>({
    key: `bounce-profile:${address}`,
    fetcher: async () => {
      const res = await fetch(`/api/bounce/profile/${address}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const shareUrl = `https://info-hub.io/bounce/${address}`;
  const cardUrl = `https://info-hub.io/api/og/rekt/${address}`;
  const tweetText = data
    ? `check out this rekt profile on @info_hub69 🔥\n\nscore ${data.score}/1000 · ${data.rank ? '#' + data.rank : 'ranked'} · $${((data.totalNotional || 0) / 1e6).toFixed(1)}M rekt`
    : '';
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(tweetText)}`;

  const copy = useCallback(async (kind: 'link' | 'tweet') => {
    try {
      const text = kind === 'link' ? shareUrl : tweetText + '\n\n' + shareUrl;
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* noop */ }
  }, [shareUrl, tweetText]);

  return (
    <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <Link href={`/bounce/${address}`} className="text-neutral-500 hover:text-hub-yellow transition-colors inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> back to profile
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-400 font-mono">share {short(address)}</span>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Shareable Rekt Card</h2>
        <p className="text-sm text-neutral-500">
          A 1200×630 image auto-generated from this wallet&apos;s rekt profile. Pops nicely on X, Telegram, Discord, Farcaster.
        </p>
      </div>

      {/* The card preview */}
      <div className="card-premium p-3 mb-4">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2 px-1">Preview</div>
        <div className="relative aspect-[1200/630] rounded-lg overflow-hidden border border-white/[0.08] bg-hub-dark">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse text-neutral-500 text-sm">Generating card…</div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardUrl}
              alt={`Rekt card for ${short(address)}`}
              className="w-full h-full object-contain"
              loading="eager"
            />
          )}
        </div>
      </div>

      {/* Share actions */}
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className="card-premium p-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Share on socials</div>
          <div className="flex flex-wrap gap-2">
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white border border-white/[0.15] hover:bg-white/[0.08] text-sm font-semibold transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Post on X
            </a>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0088cc]/80 hover:bg-[#0088cc] text-white text-sm font-semibold transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.61 7.61c-.12.55-.44.68-.89.42l-2.46-1.81-1.19 1.14c-.13.13-.25.25-.5.25l.18-2.56 4.67-4.21c.2-.18-.04-.28-.31-.1l-5.77 3.63-2.49-.77c-.54-.17-.55-.54.11-.8l9.74-3.76c.45-.17.85.11.69.96z"/></svg>
              Share to Telegram
            </a>
          </div>
        </div>

        <div className="card-premium p-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Copy links</div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => copy('link')}
              className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white transition-colors"
            >
              <span className="truncate font-mono text-xs">{shareUrl}</span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-neutral-400">
                {copied === 'link' ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </span>
            </button>
            <button
              type="button"
              onClick={() => copy('tweet')}
              className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white transition-colors"
            >
              <span className="truncate text-xs text-neutral-300">Copy pre-written tweet</span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-neutral-400">
                {copied === 'tweet' ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </span>
            </button>
            <a
              href={cardUrl}
              download={`rekt-${short(address)}.png`}
              className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white transition-colors"
            >
              <span className="text-xs text-neutral-300">Download PNG</span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-neutral-400">
                <Download className="w-3 h-3" /> Save
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* CTA back */}
      <div className="card-premium p-4 mb-4 bg-gradient-to-br from-red-500/[0.04] to-transparent border border-red-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-400/10 flex items-center justify-center flex-shrink-0">
            <Flame className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Not your wallet?</div>
            <div className="text-[12px] text-neutral-500">Check any address for its rekt score.</div>
          </div>
          <Link
            href="/bounce/check"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-400 text-black font-bold text-xs hover:bg-red-300 transition-colors"
          >
            Lookup <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          The card image is generated on-the-fly from InfoHub&apos;s rekt data and cached at the CDN edge for 5 minutes.
          Social platforms unfurl the OG image automatically when you paste the link — no upload needed.
        </div>
      </div>
    </main>
  );
}
