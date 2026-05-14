import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import Link from 'next/link';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle2, ExternalLink,
  TrendingDown, Zap, Activity, Eye, Shield, Layers,
} from 'lucide-react';
import { ALL_EXCHANGES } from '@/lib/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Surviving Liquidation Cascades | InfoHub',
  description:
    'When leveraged positions unwind, prices move fast. This guide breaks down how cascades form, how to spot one before it triggers, and how to either stay out of the way or trade it.',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 pb-2 border-b border-white/[0.06]">{title}</h2>
      {children}
    </section>
  );
}

function Callout({ type, children }: { type: 'tip' | 'warning' | 'example'; children: React.ReactNode }) {
  const styles = {
    tip: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
    warning: 'bg-red-500/5 border-red-500/20 text-red-400',
    example: 'bg-hub-yellow/5 border-hub-yellow/20 text-hub-yellow',
  };
  const icons = {
    tip: <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />,
    example: <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${styles[type]} my-4`}>
      {icons[type]}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function SurvivingLiquidationCascadesPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto">

          {/* Back link */}
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-hub-yellow text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Guides
          </Link>

          {/* Hero */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-neutral-500 border border-white/[0.06]">Trading</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border text-rose-400 bg-rose-500/10 border-rose-500/20">Advanced</span>
              <span className="text-[10px] text-neutral-600 flex items-center gap-1"><Clock className="w-3 h-3" /> 14 min read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              Surviving Liquidation Cascades
            </h1>
            <p className="text-neutral-400 text-base leading-relaxed">
              When too many leveraged positions sit at the same price level and the market punches
              through it, the chain reaction is fast and ugly. Here&apos;s how cascades form, how
              to see one coming, and how to either stay out of the way or position yourself
              on the right side of the waterfall.
            </p>
          </div>

          {/* Table of contents */}
          <nav className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 mb-10">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">In this guide</h3>
            <ol className="space-y-1.5 text-sm">
              {[
                ['anatomy', 'Anatomy of a cascade'],
                ['why-they-keep-happening', 'Why they keep happening'],
                ['precursors', 'The 5 precursors to watch'],
                ['cluster-map', 'Reading the liquidation cluster map'],
                ['whale-watch', 'Whale-liquidation roulette'],
                ['playbook-defense', 'Defensive playbook (don\'t blow up)'],
                ['playbook-offense', 'Offensive playbook (trading the cascade)'],
                ['after-the-flush', 'What happens after the flush'],
                ['checklist', 'Pre-cascade checklist'],
              ].map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex items-center gap-2 text-neutral-500 hover:text-hub-yellow transition-colors py-0.5">
                    <span className="text-hub-yellow/40 font-mono text-xs w-4">{i + 1}.</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* ─── Content ─── */}

          <Section id="anatomy" title="1. Anatomy of a cascade">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              A liquidation cascade is what happens when a price move forces leveraged positions
              to close, and those forced closes <em>are themselves</em> the next leg of the
              price move. It&apos;s a positive-feedback loop. The bigger the leveraged book at
              one price level, the bigger the cascade when that level breaks.
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Mechanically it goes:
            </p>
            <ol className="text-neutral-300 text-sm leading-relaxed space-y-2 mb-4 list-decimal pl-5">
              <li>Price ticks down, brushing the liquidation level for a tier of long positions.</li>
              <li>Each exchange&apos;s liquidation engine closes those positions <strong className="text-white">at market</strong> — they don&apos;t care about price impact.</li>
              <li>Those forced market sells push price further down.</li>
              <li>The next tier of longs hits its liquidation price. Repeat.</li>
              <li>Liquidity providers widen their quotes (they don&apos;t know what they&apos;re catching), so each subsequent forced sale moves price even further.</li>
              <li>When the leveraged book at that range is exhausted, price snaps back as buyers re-enter the now-cheap market. The wick is born.</li>
            </ol>
            <Callout type="example">
              August 17, 2024: $1.2B in BTC longs liquidated in 4 hours. Aug 5, 2024: $1B in
              ETH longs liquidated in 12 hours. October 11, 2024 ($560M in 90 min). The
              pattern shows up again and again — what differs is which side (long or short)
              gets caught.
            </Callout>
          </Section>

          <Section id="why-they-keep-happening" title="2. Why they keep happening">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Three structural reasons:
            </p>
            <div className="space-y-3 my-5">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-rose-400" />
                  <span className="text-white text-sm font-bold">Crypto perps allow extreme leverage</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Up to 100x on most retail venues (50x typical, 125x on Binance for some pairs).
                  Equity futures cap at ~25x. Forex retail caps at 30:1 in most jurisdictions.
                  More leverage = thinner liquidation buffer = more cascade fuel per dollar of OI.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span className="text-white text-sm font-bold">Round-number levels concentrate liq prices</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Most retail traders enter at clean prices ($60k, $70k, $4k) and use round
                  leverage tiers (5x, 10x, 20x). Their liquidation prices end up clustered
                  too — say, BTC longs entered at $70k with 10x all liquidate around $63k.
                  When price hits $63k, they all go at once.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-rose-400" />
                  <span className="text-white text-sm font-bold">Liquidation engines don&apos;t shop for price</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  When a position triggers, the exchange dumps it at market — accepting whatever
                  the book offers. In thin liquidity (weekends, off-hours, exotic alts), that
                  market order can move price 5-10% on its own, immediately triggering the
                  next tier.
                </p>
              </div>
            </div>
          </Section>

          <Section id="precursors" title="3. The 5 precursors to watch">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Cascades don&apos;t come out of nowhere. The setup builds for hours or days.
              These five signals together = elevated cascade risk:
            </p>
            <div className="space-y-3 my-4">
              {[
                {
                  n: 1,
                  label: 'Open interest at all-time high (or recent high)',
                  body: (
                    <>
                      The bigger the leveraged book, the more cascade fuel. Compare current OI
                      to the 30-day max on{' '}
                      <Link href="/open-interest" className="text-hub-yellow hover:underline">/open-interest</Link>.
                      When OI prints a new high while price is flat, leverage is being added
                      without a directional move — cascades love this setup.
                    </>
                  ),
                },
                {
                  n: 2,
                  label: 'Funding rates extreme in one direction (longs >0.05%/8h or shorts <-0.05%/8h)',
                  body: (
                    <>
                      Persistent positive funding means longs are paying shorts to hold their
                      positions — the longs are leveraged and bullish. That&apos;s fuel for a
                      LONG-side cascade if price reverses. Mirror for shorts. See{' '}
                      <Link href="/funding" className="text-hub-yellow hover:underline">/funding</Link>{' '}
                      for live rates across {ALL_EXCHANGES.length}+ venues.
                    </>
                  ),
                },
                {
                  n: 3,
                  label: 'Liquidation clusters visible at nearby price levels',
                  body: (
                    <>
                      The{' '}
                      <Link href="/liquidation-levels" className="text-hub-yellow hover:underline">/liquidation-levels</Link>{' '}
                      page maps the empirical liquidation buckets where positions actually got
                      rekt over the past 24h. Big stacked bars under current price = a cascade
                      runway if price ticks down.
                    </>
                  ),
                },
                {
                  n: 4,
                  label: 'Whale positions sitting close to their liq price',
                  body: (
                    <>
                      A single whale getting forced out can be 5-10% of the cascade by itself.{' '}
                      <Link href="/whale-liq" className="text-hub-yellow hover:underline">/whale-liq</Link>{' '}
                      ranks every Hyperliquid whale by distance-to-liq. When several show up
                      in the &quot;Tight (&lt;5%)&quot; bucket on the same coin, that&apos;s the trigger.
                    </>
                  ),
                },
                {
                  n: 5,
                  label: 'Long/short ratio skewed >65% one side',
                  body: (
                    <>
                      Healthy markets sit around 50/50. When BTC long/short flips to 70/30
                      longs, the consensus is wrong — and consensus getting wrong fast is
                      what fuels a cascade. Watch{' '}
                      <Link href="/longshort" className="text-hub-yellow hover:underline">/longshort</Link>{' '}
                      for the live ratio per coin.
                    </>
                  ),
                },
              ].map((s) => (
                <div key={s.n} className="flex gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-xs font-bold flex items-center justify-center">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold mb-1">{s.label}</div>
                    <p className="text-neutral-400 text-xs leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="tip">
              No single signal is reliable. Two of five = elevated risk. Four or five together = cascade
              setup. The market doesn&apos;t always trigger — sometimes positions just unwind quietly.
              But when it does trigger, it&apos;s violent.
            </Callout>
          </Section>

          <Section id="cluster-map" title="4. Reading the liquidation cluster map">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              The{' '}
              <Link href="/liquidation-levels?symbol=BTC" className="text-hub-yellow hover:underline">/liquidation-levels</Link>{' '}
              page combines two views into one chart:
            </p>
            <ul className="text-neutral-300 text-sm leading-relaxed space-y-2 mb-4 list-disc pl-5">
              <li>
                <strong className="text-white">Empirical histogram</strong> — actual liquidations
                that happened in the last window (4h / 12h / 24h / 48h), bucketed by price.
                These are <em>past</em> events.
              </li>
              <li>
                <strong className="text-white">Forecast clusters</strong> — estimated liquidation
                levels <em>still ahead</em>, derived from current aggregate OI × an assumed
                leverage mix (50% @ 5x, 30% @ 10x, 15% @ 20x, 5% @ 50x). These are the
                landmines waiting to be stepped on.
              </li>
            </ul>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              How to read it:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 my-5">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-rose-400 text-sm font-bold mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Below current price
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Long-side liquidation tiers. If a big stack sits 3-7% below current price,
                  any sharp move down has the fuel to cascade through it. Each tier is labeled
                  by leverage — the 5x tier (small drop required) is the most relevant.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-emerald-400 text-sm font-bold mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 rotate-180" /> Above current price
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Short-side liquidation tiers. A short squeeze rallies through these.
                  Big short clusters above price = upside fuel. The bigger the cluster relative
                  to recent volume, the more violent the squeeze if it triggers.
                </p>
              </div>
            </div>
            <Callout type="warning">
              The forecast tiers are <em>estimates</em>, not guarantees. Real traders use mixed
              leverage, isolated vs cross margin, partial hedges. Treat the clusters as
              <em> directional signals</em> (&quot;liquidity is concentrated here&quot;) not exact prices.
            </Callout>
          </Section>

          <Section id="whale-watch" title="5. Whale-liquidation roulette">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              On Hyperliquid every position is publicly indexable — wallet, size, entry, mark, and
              liquidation price. The{' '}
              <Link href="/whale-liq" className="text-hub-yellow hover:underline">/whale-liq</Link>{' '}
              page sorts every whale position by distance-to-liq, with live presets:
            </p>
            <div className="space-y-2 my-4">
              {[
                ['🔥 Danger zone', '<2%', 'Single price tick away. These are about to trigger.'],
                ['🚨 Tight', '<5%', 'Within a normal day&apos;s range. High probability this week.'],
                ['⚠️ Watching', '<10%', 'Needs a real move. Worth tracking but not imminent.'],
                ['👀 Wide', '<20%', 'Well-collateralized. Healthy market position.'],
              ].map(([label, range, desc]) => (
                <div key={label as string} className="flex items-baseline gap-3 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <span className="text-sm font-semibold text-white w-32 flex-shrink-0">{label}</span>
                  <span className="text-xs font-mono text-rose-400 w-12 flex-shrink-0">{range}</span>
                  <span className="text-xs text-neutral-400" dangerouslySetInnerHTML={{ __html: desc as string }} />
                </div>
              ))}
            </div>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              <strong className="text-white">Why the whales matter disproportionately:</strong> a
              $50M position liquidating into a thin book moves price more than $50M of organic
              flow because liquidation is unconditional — the engine doesn&apos;t shop for price.
              Three or four whales triggering together can move BTC 1-2% on a quiet day.
            </p>
            <Callout type="tip">
              Bookmark the &quot;Tight&quot; preset on{' '}
              <Link href="/whale-liq" className="text-hub-yellow hover:underline">/whale-liq</Link>.
              When the count under that filter spikes from its usual baseline, something
              structural is brewing — even before the cascade actually fires.
            </Callout>
          </Section>

          <Section id="playbook-defense" title="6. Defensive playbook (don't blow up)">
            <div className="space-y-3 my-4">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-bold">Reduce leverage when precursors stack</span>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  If 4 of the 5 precursors are flashing, halve your position size or move to a
                  lower leverage tier. The cascade may not happen — but if it does, you&apos;d
                  rather have spare margin than a forced exit.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-bold">Move your liq price away from cluster levels</span>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  Add margin so your liquidation falls below (longs) / above (shorts) the visible
                  forecast clusters on{' '}
                  <Link href="/liquidation-levels" className="text-hub-yellow hover:underline">/liquidation-levels</Link>.
                  The cascade will eat through the cluster — you don&apos;t want to be in it.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-bold">Use stop-LIMITs not stop-MARKETs near clusters</span>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  In a cascade, market stops fill at terrible prices because liquidity vanishes
                  for the duration of the wick. Stop-limits cap your slippage, but they can also
                  miss the fill — which is the right tradeoff when the alternative is filling
                  3-5% below your stop level.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-bold">Cross-margin is fragile — isolate the bet you&apos;re willing to lose</span>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  Cross-margin pools your whole account. A cascade in one position can liquidate
                  positions you weren&apos;t even thinking about. Isolated margin per position
                  caps the blast radius — you lose only the margin posted to that trade.
                </p>
              </div>
            </div>
            <Callout type="warning">
              The <strong>single biggest survivability move</strong> is reducing leverage <em>before</em>{' '}
              the cascade. Once it&apos;s firing, your stops won&apos;t hit at the prices you set
              and adding margin requires a deposit that exchanges may rate-limit during volatility.
              Pre-position your defense on calm days.
            </Callout>
          </Section>

          <Section id="playbook-offense" title="7. Offensive playbook (trading the cascade)">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Cascades are predictable in <em>where</em> they go and <em>when</em> they end —
              not in <em>when</em> they start. Two playable trades:
            </p>
            <div className="space-y-4 my-5">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-white">A. Fade the wick (mean reversion)</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  Cascades overshoot. The forced sales create a brief liquidity hole below
                  fair value. After the leveraged book at that range is exhausted, price
                  snaps back as discretionary buyers step in.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  <strong className="text-white">Setup:</strong> identify the bottom of the
                  forecast cluster on /liquidation-levels. When price wicks below that level
                  on a 1m candle and reclaims within 2-3 minutes, the cascade is exhausted.
                  Long with a tight stop just under the wick.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  <strong className="text-white">Risk:</strong> if it&apos;s not a cascade but a
                  real trend break, your &quot;wick&quot; is just the start of a longer move down.
                  Use small size, tight stops, and exit if price doesn&apos;t reclaim within 5 min.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-white">B. Front-run the cluster (trend continuation)</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  When precursors stack AND price is approaching a big cluster, short into the
                  cluster (or close longs). Once price breaks the level the cascade does the
                  work for you.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  <strong className="text-white">Setup:</strong> 4+ precursors firing, current
                  price within 2% of a major liquidation cluster, momentum already negative.
                  Short with a stop above the cluster top (in case the level holds).
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  <strong className="text-white">Risk:</strong> the cluster level holds and price
                  bounces. Or worse — the OPPOSITE side cascades because consensus was leaning
                  the wrong way. Always check funding direction; persistent positive funding
                  means longs are crowded, so a long cascade is more likely than a short squeeze.
                </p>
              </div>
            </div>
            <Callout type="warning">
              Both trades are professional setups with a low hit rate but high payoff per win.
              Size accordingly — never more than 1-2% of account per cascade trade. The cost of
              being wrong on a cascade trade is high because you&apos;re trading into a moving
              market with vanishing liquidity.
            </Callout>
          </Section>

          <Section id="after-the-flush" title="8. What happens after the flush">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              The post-cascade window is one of the most reliable trading setups in crypto:
            </p>
            <ul className="text-neutral-300 text-sm leading-relaxed space-y-2 mb-4 list-disc pl-5">
              <li>
                <strong className="text-white">OI drops sharply</strong> — by definition,
                positions just got closed. Watch{' '}
                <Link href="/open-interest" className="text-hub-yellow hover:underline">/open-interest</Link>{' '}
                — the OI delta column shows the size of the flush.
              </li>
              <li>
                <strong className="text-white">Funding rates flip</strong> — extreme funding
                often resets to neutral or even reverses. If it was +0.05% pre-cascade, it
                might be -0.02% an hour later.
              </li>
              <li>
                <strong className="text-white">Long/short ratio rebalances</strong> — the
                crowded side just got thinned out. The market is structurally healthier
                immediately after a cascade than immediately before.
              </li>
              <li>
                <strong className="text-white">Realized volatility spikes</strong> then
                normalizes within 12-24h. Implied volatility on options stays elevated longer —
                option-sellers can earn premium in the post-cascade calm.
              </li>
            </ul>
            <Callout type="tip">
              The 24-48h after a major cascade is historically a good entry window for
              swing trades aligned with the dominant trend. The leverage washout removes the
              most fragile positions, and the remaining longs (or shorts) are stickier.
            </Callout>
          </Section>

          <Section id="checklist" title="9. Pre-cascade checklist">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Before each session — especially before sleeping with positions open, or before
              high-volatility events (FOMC, CPI, exchange announcements) — run this scan:
            </p>
            <div className="space-y-2 my-4">
              {[
                ['OI vs 30-day max — within 10% of max?', '/open-interest'],
                ['Funding rate — extreme one direction (>0.05%/8h)?', '/funding'],
                ['Liquidation clusters — big stack within 5% of price?', '/liquidation-levels'],
                ['Whales at &lt;5% distance to liq — count above baseline?', '/whale-liq'],
                ['Long/short ratio — >65% one side?', '/longshort'],
                ['My own liq price — buffered against the nearest cluster?', null],
                ['My margin mode — isolated for risky positions, cross only for low-leverage core?', null],
                ['Stop type — limits not markets near visible clusters?', null],
              ].map(([q, href], i) => (
                <div key={i} className="flex items-baseline gap-3 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <input type="checkbox" className="mt-1 rounded border-white/20 bg-white/5 text-hub-yellow focus:ring-hub-yellow/30" />
                  <span className="text-xs text-neutral-300 leading-snug flex-1" dangerouslySetInnerHTML={{ __html: q as string }} />
                  {href && (
                    <Link href={href as string} className="text-[10px] text-hub-yellow hover:underline flex items-center gap-0.5 flex-shrink-0">
                      check <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Boxes checked = position sized appropriately. Several unchecked while in size = reduce
              risk first, ask why later.
            </p>
          </Section>

          {/* Closing CTA */}
          <div className="mt-12 p-6 rounded-xl bg-gradient-to-br from-rose-500/10 to-amber-500/5 border border-rose-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-bold text-white">Watch this in real time</span>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed mb-4">
              All the signals above run live on InfoHub, alongside the actual cascade-trigger
              data feeds. You don&apos;t need to wire anything together — open the relevant pages
              in tabs and you&apos;re looking at the same dashboards used by serious perp traders.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/whale-liq" className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Whale Liq Roulette
              </Link>
              <Link href="/liquidation-levels" className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Liquidation Levels
              </Link>
              <Link href="/funding" className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3" /> Funding Rates
              </Link>
              <Link href="/open-interest" className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Open Interest
              </Link>
            </div>
          </div>

          <div className="mt-10">
            <ReferralBanner />
          </div>

          {/* Related guides */}
          <div className="mt-12 pt-6 border-t border-white/[0.06]">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Related guides</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link href="/guides/reading-open-interest" className="block p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-hub-yellow/40 transition-colors">
                <div className="text-white text-sm font-semibold mb-1">Reading Open Interest Like a Pro</div>
                <p className="text-neutral-500 text-xs leading-relaxed">OI is the one metric most traders ignore — and the one that tells you the most.</p>
              </Link>
              <Link href="/guides/funding-rate-arbitrage" className="block p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-hub-yellow/40 transition-colors">
                <div className="text-white text-sm font-semibold mb-1">Funding Rate Arbitrage</div>
                <p className="text-neutral-500 text-xs leading-relaxed">Profit from funding rate differences across exchanges, regardless of market direction.</p>
              </Link>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
