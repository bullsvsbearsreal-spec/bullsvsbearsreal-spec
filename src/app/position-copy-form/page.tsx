/**
 * Position copy form — the "I saw a whale do this, let me mirror it" page.
 *
 * Reachable via deeplinks from /hl-whales, /smart-money, /hl-traders,
 * /gmx-traders, /compare-traders. URL params do all the pre-fill so the
 * page is purely a friction-killer between "discovered an interesting
 * position" and "ready to put on my own version of the trade."
 *
 * Query params (all optional except symbol):
 *   ?wallet=0x...           — original wallet (for credit + watch link)
 *   ?label=NAME             — human-readable trader name
 *   ?symbol=ETH             — REQUIRED — the asset
 *   ?side=long|short        — direction (default long)
 *   ?sizeUsd=500000         — original position notional (USD)
 *   ?entryPrice=2400        — original wallet's entry price
 *   ?venue=hl|gmx-arb|gmx-avax  — origin exchange (for slippage context)
 *   ?leverage=10            — original leverage (we copy as default)
 *
 * What this page does:
 *   1. Renders the original trade in a "you saw" panel
 *   2. Shows a sizing scalar (0.25× / 0.5× / 1× / 2×) so the user can
 *      pick what fraction of the original notional they want to put on
 *   3. Pulls live spot price and shows "current vs whale entry" with a
 *      slippage % + chase-risk indicator (color-graded)
 *   4. Links out to /position-size?... with the chosen size baked in so
 *      the user can refine the Kelly/risk side, then to the actual venue
 *
 * Intentional non-features:
 *   - We do NOT auto-execute the trade. We're an info terminal, not a
 *     broker — execution still happens on the user's exchange of choice.
 *   - We do NOT recompute "is this still a good entry" with TA logic —
 *     that's signal noise. We surface the data + let the user decide.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Copy, ExternalLink, AlertTriangle, TrendingUp, Eye, Calculator } from 'lucide-react';
import useSWR from 'swr';

interface CopyFormParams {
  wallet?: string;
  label?: string;
  symbol: string;
  side: 'long' | 'short';
  sizeUsd: number;
  entryPrice: number;
  venue: string;
  leverage: number;
}

const SIZING_SCALARS = [0.25, 0.5, 1, 2] as const;
type Scalar = typeof SIZING_SCALARS[number];

const VENUE_LABEL: Record<string, string> = {
  hl: 'Hyperliquid',
  'gmx-arb': 'GMX (Arbitrum)',
  'gmx-avax': 'GMX (Avalanche)',
  hyperliquid: 'Hyperliquid',
  gmx: 'GMX',
};

/* ─── Fetcher for live spot price (CMC fallback to spot-prices) ──── */
const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

export default function PositionCopyFormPage() {
  const sp = useSearchParams();

  const parsed = useMemo<CopyFormParams | null>(() => {
    const symbol = (sp.get('symbol') || '').toUpperCase().trim();
    if (!symbol || !/^[A-Z0-9]{1,12}$/.test(symbol)) return null;
    const sizeUsd = Math.max(0, Number(sp.get('sizeUsd') || 0)) || 0;
    const entryPrice = Math.max(0, Number(sp.get('entryPrice') || 0)) || 0;
    const leverage = Math.max(1, Math.min(125, Number(sp.get('leverage') || 1))) || 1;
    return {
      wallet: sp.get('wallet') || undefined,
      label: sp.get('label') || undefined,
      symbol,
      side: (sp.get('side') === 'short' ? 'short' : 'long'),
      sizeUsd,
      entryPrice,
      venue: sp.get('venue') || 'hl',
      leverage,
    };
  }, [sp]);

  const [scalar, setScalar] = useState<Scalar>(1);

  // Spot price for chase-risk indicator. Uses internal /api/coin-data
  // endpoint which is CMC-backed.
  const { data: priceData } = useSWR(
    parsed?.symbol ? `/api/coin-data?symbol=${parsed.symbol}` : null,
    fetcher,
    { refreshInterval: 15_000, revalidateOnFocus: false },
  );

  if (!parsed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-white mb-1">Missing symbol</h1>
          <p className="text-sm text-neutral-400">
            This page expects a deeplink like <code className="text-[11px] font-mono bg-black/40 px-1.5 py-0.5 rounded">?symbol=ETH&amp;side=long&amp;sizeUsd=500000</code>.
          </p>
          <Link href="/hl-whales" className="inline-flex items-center gap-1.5 mt-4 text-sm text-emerald-400 hover:text-emerald-300">
            <ArrowRight className="w-3.5 h-3.5" /> Browse whales
          </Link>
        </div>
      </div>
    );
  }

  // Compute display numbers
  const yourSizeUsd = parsed.sizeUsd * scalar;
  const livePrice: number | null = priceData?.price ?? null;
  const slippagePct = livePrice && parsed.entryPrice
    ? ((livePrice - parsed.entryPrice) / parsed.entryPrice) * 100
    : null;
  // Chase risk: green if <1%, amber if 1-3%, red if >3%
  const chaseTier =
    slippagePct === null ? 'unknown'
    : Math.abs(slippagePct) < 1 ? 'safe'
    : Math.abs(slippagePct) < 3 ? 'caution'
    : 'risky';

  // For shorts, "above entry" is GOOD (you sell higher than the whale).
  // For longs, "above entry" is BAD (you buy higher than the whale).
  const chaseIsGoodForYou = slippagePct !== null && (
    (parsed.side === 'long' && slippagePct <= 0) ||
    (parsed.side === 'short' && slippagePct >= 0)
  );

  const sideColor = parsed.side === 'long' ? 'text-emerald-400' : 'text-rose-400';
  const sideBg = parsed.side === 'long' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30';
  const venueLabel = VENUE_LABEL[parsed.venue] || parsed.venue;

  // Position-size deeplink — let the user refine their bet using the
  // full Kelly/risk calculator on /position-size with size pre-filled.
  const positionSizeUrl = `/position-size?symbol=${parsed.symbol}&side=${parsed.side}&sizeUsd=${Math.round(yourSizeUsd)}&entry=${livePrice ?? parsed.entryPrice}`;

  // Watch the wallet — frictionless "follow this trader" flow
  const watchUrl = parsed.wallet
    ? `/watch?add=${encodeURIComponent(parsed.wallet)}${parsed.label ? `&label=${encodeURIComponent(parsed.label)}` : ''}`
    : null;

  // Direct chart link for confirmation
  const chartUrl = `/chart?s=${parsed.symbol}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
      {/* ─── Page header ─── */}
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">Copy trade · 2-step</div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Mirror this position</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Pick a size scalar, refine on /position-size, execute on your exchange. We don&apos;t place trades for you.
        </p>
      </header>

      {/* ─── Step 1: What you saw ─── */}
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2 px-1">Step 1 · The original trade</div>
        <div className={`rounded-xl border ${sideBg} p-5`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${sideColor} ${parsed.side === 'long' ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                  {parsed.side}
                </span>
                <span className="text-lg font-bold text-white">{parsed.symbol}</span>
                <span className="text-xs text-neutral-500">@ {parsed.leverage}× on {venueLabel}</span>
              </div>
              <div className="text-[11px] text-neutral-500">
                {parsed.label ? <><span className="text-neutral-300">{parsed.label}</span> · </> : null}
                {parsed.wallet ? <code className="font-mono">{parsed.wallet.slice(0, 6)}…{parsed.wallet.slice(-4)}</code> : 'Unknown wallet'}
              </div>
            </div>
            {watchUrl && (
              <Link
                href={watchUrl}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-neutral-300 hover:bg-white/[0.08] hover:text-white"
              >
                <Eye className="w-3 h-3" /> Watch wallet
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Cell label="Size" value={parsed.sizeUsd > 0 ? `$${parsed.sizeUsd.toLocaleString()}` : '—'} />
            <Cell label="Entry" value={parsed.entryPrice > 0 ? `$${parsed.entryPrice.toLocaleString()}` : '—'} />
            <Cell label="Live" value={livePrice ? `$${livePrice.toLocaleString()}` : '—'} />
            <Cell
              label="Drift from entry"
              value={slippagePct === null ? '—' : `${slippagePct >= 0 ? '+' : ''}${slippagePct.toFixed(2)}%`}
              tone={
                chaseTier === 'unknown' ? 'neutral'
                : chaseIsGoodForYou ? 'good'
                : chaseTier === 'safe' ? 'neutral'
                : chaseTier === 'caution' ? 'caution' : 'bad'
              }
            />
          </div>
          {slippagePct !== null && chaseTier !== 'safe' && !chaseIsGoodForYou && (
            <div className="mt-4 text-[11px] flex items-start gap-2 text-amber-400/90 bg-amber-500/[0.05] border border-amber-500/20 rounded-lg p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Current price is {Math.abs(slippagePct).toFixed(2)}% {slippagePct > 0 ? 'above' : 'below'} the whale&apos;s entry. {chaseTier === 'risky' ? 'Chasing this far from their fill significantly worsens R:R — consider waiting for a pullback or using a smaller scalar.' : 'You\'ll get a worse fill than the original; size down or wait.'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ─── Step 2: Pick your size ─── */}
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2 px-1">Step 2 · Your size</div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="text-xs text-neutral-400 mb-3">
            Pick what fraction of the original size you want to put on. Most copy traders run <span className="text-white font-semibold">0.25–0.5×</span> until they trust a wallet.
          </div>
          <div className="flex gap-2 mb-4">
            {SIZING_SCALARS.map((s) => (
              <button
                key={s}
                onClick={() => setScalar(s)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-colors ${
                  scalar === s
                    ? 'bg-emerald-500 border-emerald-500 text-black'
                    : 'bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-white/[0.05]">
            <Cell label="Your size" value={yourSizeUsd > 0 ? `$${Math.round(yourSizeUsd).toLocaleString()}` : '—'} tone="good" />
            <Cell label="Margin @ same lev" value={yourSizeUsd > 0 ? `$${Math.round(yourSizeUsd / parsed.leverage).toLocaleString()}` : '—'} />
          </div>
        </div>
      </section>

      {/* ─── Step 3: Next actions ─── */}
      <section>
        <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2 px-1">Step 3 · Refine + execute</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href={positionSizeUrl}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.1] p-4 transition-colors group"
          >
            <Calculator className="w-4 h-4 text-emerald-400 mb-2" />
            <div className="text-sm font-semibold text-white mb-0.5">Refine on Position Size</div>
            <div className="text-[11px] text-neutral-500">Kelly / R:R · stop placement · liq preview</div>
            <div className="text-[11px] text-emerald-400 mt-2 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Open <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
          <Link
            href={chartUrl}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors group"
          >
            <TrendingUp className="w-4 h-4 text-sky-400 mb-2" />
            <div className="text-sm font-semibold text-white mb-0.5">Confirm on chart</div>
            <div className="text-[11px] text-neutral-500">{parsed.symbol} · multi-TF · indicators</div>
            <div className="text-[11px] text-sky-400 mt-2 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Open <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
          <CopyShareLink params={parsed} scalar={scalar} />
        </div>
      </section>

      {/* ─── Disclaimer ─── */}
      <p className="text-[10px] text-neutral-600 mt-8 text-center max-w-md mx-auto leading-relaxed">
        Copy-trading is not financial advice. Whale wallets can dump on followers. Past performance does not guarantee future results. Risk-manage every trade.
      </p>
    </div>
  );
}

/* ─── Reusable cell ──────────────────────────────────────────────── */

function Cell({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' | 'caution' }) {
  const toneColor = {
    neutral: 'text-white',
    good: 'text-emerald-400',
    bad: 'text-rose-400',
    caution: 'text-amber-400',
  }[tone];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-0.5">{label}</div>
      <div className={`font-mono text-sm font-semibold ${toneColor}`}>{value}</div>
    </div>
  );
}

/* ─── Share-link button — copy current URL to clipboard ──────────── */

function CopyShareLink({ params, scalar }: { params: CopyFormParams; scalar: Scalar }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const u = new URL(window.location.href);
    u.searchParams.set('scalar', String(scalar));
    return u.toString();
  }, [scalar]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      onClick={() => {
        if (!url) return;
        navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {});
      }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] p-4 text-left transition-colors group"
    >
      <Copy className="w-4 h-4 text-violet-400 mb-2" />
      <div className="text-sm font-semibold text-white mb-0.5">{copied ? 'Link copied!' : 'Share this setup'}</div>
      <div className="text-[11px] text-neutral-500">{copied ? `Paste in Telegram / Discord` : 'Copy current URL'}</div>
      <div className="text-[11px] text-violet-400 mt-2 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
        Copy <ExternalLink className="w-3 h-3" />
      </div>
    </button>
  );
}
