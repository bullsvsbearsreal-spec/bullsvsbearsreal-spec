'use client';

import Link from 'next/link';
import { ArrowRight, ExternalLink, Info, CheckCircle2, Sparkles, Search, Flame } from 'lucide-react';

export default function BounceClaimPage() {
  return (
    <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">How to Claim BOUNCE</h2>
        <p className="text-sm text-neutral-500">
          If you got liquidated on Hyperliquid, you probably have a score waiting. Here&apos;s the walkthrough.
        </p>
      </div>

      {/* Hero CTA */}
      <div className="card-premium p-6 mb-6 bg-gradient-to-br from-red-500/[0.06] via-orange-500/[0.03] to-transparent border border-red-400/25 text-center">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-red-400/15 text-red-400 font-bold mb-3">
          <Flame className="w-3 h-3" /> private beta
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">Got rekt? You might qualify.</h1>
        <p className="text-sm text-neutral-400 max-w-lg mx-auto mb-4">
          bounce.tech scored every wallet on Hyperliquid&apos;s liquidation history. The worse you got caught, the bigger your potential claim.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/bounce/check"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-red-400 text-black font-bold rounded-lg text-sm hover:bg-red-300 transition-colors"
          >
            <Search className="w-3.5 h-3.5" /> Check your score first
          </Link>
          <a
            href="https://bounce.tech/register"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white/[0.06] border border-white/[0.1] text-white font-semibold rounded-lg text-sm hover:bg-white/[0.1] transition-colors"
          >
            Register on bounce.tech <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-red-400/15 text-red-400 flex items-center justify-center font-bold text-sm">1</div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">Check your score</div>
          </div>
          <p className="text-[12px] text-neutral-400 leading-relaxed mb-3">
            Use InfoHub&apos;s lookup to see your rekt profile without signing up. If rank is null and all fields are zero, your wallet isn&apos;t indexed.
          </p>
          <Link href="/bounce/check" className="text-xs text-hub-yellow hover:underline inline-flex items-center gap-1">
            Go to lookup <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-orange-400/15 text-orange-400 flex items-center justify-center font-bold text-sm">2</div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">Register on bounce.tech</div>
          </div>
          <p className="text-[12px] text-neutral-400 leading-relaxed mb-3">
            Head to bounce.tech and connect the wallet that got rekt. You&apos;ll need an invite code for the private beta (search their X for active codes).
          </p>
          <a
            href="https://bounce.tech/register"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-hub-yellow hover:underline inline-flex items-center gap-1"
          >
            bounce.tech/register <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-yellow-400/15 text-yellow-400 flex items-center justify-center font-bold text-sm">3</div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">Claim your BOUNCE</div>
          </div>
          <p className="text-[12px] text-neutral-400 leading-relaxed mb-3">
            Sign a message to verify wallet ownership. Your score becomes a claimable BOUNCE allocation. Terms vary with score tier, larger scores get larger multipliers.
          </p>
          <div className="text-[11px] text-neutral-500">
            Exact distribution is set by bounce.tech, not InfoHub.
          </div>
        </div>
      </div>

      {/* Who qualifies */}
      <div className="card-premium p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-hub-yellow" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Who qualifies</h3>
        </div>
        <ul className="space-y-2 text-[12px] text-neutral-400">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span>Any Hyperliquid wallet with at least one historical liquidation event.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span>The bigger the notional + the more events, the higher your score (0-1000).</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span>Wallets liquidated on the Oct 10 2025 flash crash get a bonus tag (higher tier boost per bounce.tech&apos;s rules).</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span>Recency matters. Fresh losses are weighted higher than ancient ones.</span>
          </li>
        </ul>
      </div>

      {/* FAQ */}
      <div className="card-premium p-5 mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">FAQ</h3>
        <div className="space-y-3 text-[12px]">
          <div>
            <div className="text-white font-semibold mb-1">Is this an airdrop?</div>
            <div className="text-neutral-400 leading-relaxed">
              Effectively yes, but bounce.tech frames it as a rebate / score claim. You register, verify wallet ownership, and claim your allocation.
            </div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">Do I need to deposit anything?</div>
            <div className="text-neutral-400 leading-relaxed">
              No deposit needed to claim the rekt score. Separately, if you want to use bounce.tech&apos;s leveraged tokens (BTC3L, ETH3L, etc.) you&apos;d deposit stables.
            </div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">What if I&apos;m rank #20,000?</div>
            <div className="text-neutral-400 leading-relaxed">
              Still likely qualifies. The leaderboard shown on this site is top-100, but bounce.tech indexes the full history. Check your address in the lookup to see your actual percentile.
            </div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">When does the claim window close?</div>
            <div className="text-neutral-400 leading-relaxed">
              Not announced publicly. Protocol is in private beta so expect the claim flow to stay open for a while. Not financial advice, dates could change.
            </div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">Is InfoHub affiliated with bounce.tech?</div>
            <div className="text-neutral-400 leading-relaxed">
              No. InfoHub mirrors their public liquidation data so you can check any wallet without needing an invite. The actual claim is issued by bounce.tech.
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          This page summarises publicly-observable behaviour of bounce.tech&apos;s claim flow.
          Terms, multipliers, and deadlines are set by bounce.tech directly — always verify on{' '}
          <a href="https://bounce.tech" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">bounce.tech</a>{' '}
          before signing anything.
        </div>
      </div>
    </main>
  );
}
