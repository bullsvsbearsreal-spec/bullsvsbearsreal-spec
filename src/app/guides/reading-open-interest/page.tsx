import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Clock, BookOpen, AlertTriangle, CheckCircle2, ExternalLink, TrendingUp, TrendingDown, Zap, Activity, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reading Open Interest Like a Pro | InfoHub',
  description: 'Learn how to use open interest data to spot squeezes, predict volatility, and understand what the market is really doing. A practical guide with real examples.',
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

export default function ReadingOpenInterestPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto">

          {/* Back link */}
          <Link href="/guides" className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-hub-yellow text-sm mb-6 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Guides
          </Link>

          {/* Hero */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-neutral-500 border border-white/[0.06]">Analysis</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border text-green-400 bg-green-400/10 border-green-400/20">Beginner</span>
              <span className="text-[10px] text-neutral-600 flex items-center gap-1"><Clock className="w-3 h-3" /> 10 min read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              Reading Open Interest Like a Pro
            </h1>
            <p className="text-neutral-400 text-base leading-relaxed">
              Open interest is probably the most underrated metric in crypto derivatives.
              Most traders stare at price charts all day and completely ignore OI, which is
              a shame, because it&apos;s often the thing that tells you what&apos;s <em>actually</em> happening
              under the surface.
            </p>
          </div>

          {/* Table of contents */}
          <nav className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 mb-10">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">In this guide</h3>
            <ol className="space-y-1.5 text-sm">
              {[
                ['what-is-oi', 'What is open interest, really?'],
                ['oi-vs-volume', 'OI vs. volume: know the difference'],
                ['four-scenarios', 'The four OI scenarios every trader should know'],
                ['squeeze-setup', 'Spotting squeeze setups with OI'],
                ['oi-divergence', 'OI divergence: the quiet warning sign'],
                ['using-infohub', 'Using InfoHub to read OI'],
                ['common-mistakes', 'Common mistakes (and how to avoid them)'],
                ['cheatsheet', 'Quick reference cheatsheet'],
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

          <Section id="what-is-oi" title="1. What is open interest, really?">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Open interest is the total number of outstanding derivative contracts (futures or options) that haven&apos;t been settled yet.
              Every time someone opens a new position, OI goes up by one contract. Every time someone closes a position, it goes down.
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Here&apos;s the thing that trips people up: <strong className="text-white">every contract has two sides</strong>.
              If you go long 1 BTC, someone else went short 1 BTC. That&apos;s one contract of OI, not two.
              So when you see BTC open interest at $30 billion, that means there are $30 billion worth of longs
              and $30 billion worth of shorts outstanding.
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Think of OI as a measure of how much skin is in the game.
              High OI means a lot of traders have real money on the line. Low OI means nobody really cares.
              And when OI is changing fast, that&apos;s when things get interesting.
            </p>

            <Callout type="tip">
              <strong>Plain English:</strong> OI tells you how many bets are currently open.
              It doesn&apos;t tell you the direction of those bets (that&apos;s what long/short ratio is for),
              but it tells you how crowded the trade is.
            </Callout>
          </Section>

          <Section id="oi-vs-volume" title="2. OI vs. volume: know the difference">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              This is where most beginners get confused. Volume and OI look similar on a chart, but they measure
              completely different things.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 my-5">
              <div className="p-4 rounded-xl bg-hub-yellow/5 border border-hub-yellow/15">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-hub-yellow" />
                  <span className="text-hub-yellow text-sm font-bold">Volume</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  How many contracts <em>changed hands</em> in a period.
                  High volume means lots of activity, but it doesn&apos;t tell you if positions are being
                  opened or closed. A day-trader opening and closing the same position adds to volume twice
                  but leaves OI unchanged.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 text-sm font-bold">Open Interest</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  How many contracts are <em>currently open</em>.
                  OI only changes when new money enters (someone opens a fresh position) or leaves (someone fully closes).
                  It&apos;s a snapshot of commitment, not activity.
                </p>
              </div>
            </div>

            <Callout type="example">
              <strong>Example:</strong> BTC does $50B in 24h volume but OI stays flat.
              That&apos;s mostly day-traders and market makers churning. Now imagine volume is only $15B but OI jumps by $3B.
              That means real money just entered the market. New positions were opened and people are making directional bets.
              The second scenario is way more significant.
            </Callout>
          </Section>

          <Section id="four-scenarios" title="3. The four OI scenarios every trader should know">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              The real power of OI comes when you combine it with price action. There are four combinations,
              and each one tells a different story. Memorize these. They&apos;ll save your ass more than any indicator.
            </p>

            <div className="space-y-3 mb-4">
              {/* Scenario 1 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-xs font-bold">Price Up</span>
                  </div>
                  <span className="text-neutral-600">+</span>
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 text-xs font-bold">OI Up</span>
                  </div>
                  <span className="text-neutral-600">=</span>
                  <span className="text-white text-sm font-bold">Bullish conviction</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  New money is entering and pushing prices higher. This is the strongest bullish signal.
                  Fresh longs are opening and they&apos;re confident enough to put up capital.
                  The trend has legs. Don&apos;t fight it.
                </p>
              </div>

              {/* Scenario 2 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-xs font-bold">Price Up</span>
                  </div>
                  <span className="text-neutral-600">+</span>
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-xs font-bold">OI Down</span>
                  </div>
                  <span className="text-neutral-600">=</span>
                  <span className="text-white text-sm font-bold">Short squeeze (weak rally)</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Price is going up but contracts are closing. This means shorts are getting squeezed out.
                  They&apos;re buying back to close their losing positions. The price rise is fueled by short covering,
                  not new buying. Once the shorts are washed out, the rally often stalls. Be cautious about
                  chasing this move.
                </p>
              </div>

              {/* Scenario 3 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-xs font-bold">Price Down</span>
                  </div>
                  <span className="text-neutral-600">+</span>
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 text-xs font-bold">OI Up</span>
                  </div>
                  <span className="text-neutral-600">=</span>
                  <span className="text-white text-sm font-bold">Bearish conviction</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  New money entering as price drops. Fresh shorts are piling in. They see lower prices ahead
                  and they&apos;re putting their money where their mouth is. This is aggressive, conviction-driven selling.
                  The downtrend is real.
                </p>
              </div>

              {/* Scenario 4 */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-xs font-bold">Price Down</span>
                  </div>
                  <span className="text-neutral-600">+</span>
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-xs font-bold">OI Down</span>
                  </div>
                  <span className="text-neutral-600">=</span>
                  <span className="text-white text-sm font-bold">Long squeeze (capitulation)</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Price dropping and contracts closing. Longs are getting liquidated or panic-selling to cut losses.
                  This is the opposite of scenario 2. The selling is driven by forced liquidations,
                  not new shorts. Once the longs are flushed, the selling pressure dries up.
                  This is often where bottoms form.
                </p>
              </div>
            </div>

            <Callout type="tip">
              <strong>The mental model:</strong> Rising OI = new money entering (trend is building).
              Falling OI = money leaving (trend is exhausting). Combine this with price direction
              and you have a surprisingly accurate read on what&apos;s going on.
            </Callout>
          </Section>

          <Section id="squeeze-setup" title="4. Spotting squeeze setups with OI">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Squeezes are the bread and butter of OI analysis. Here&apos;s a setup you can start looking for today.
            </p>

            <h3 className="text-white font-semibold text-base mb-3">The crowded-trade setup</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              When OI reaches extreme levels, say all-time highs or multi-week highs, it means the market
              is very leveraged. All those positions need to eventually close. And when they start closing,
              they tend to close fast and violently.
            </p>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-4 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">1.</span>
                <span className="text-white">OI at multi-week highs</span>
                <span className="text-neutral-600">/ lots of leverage in the system</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">2.</span>
                <span className="text-white">Funding rate is extreme</span>
                <span className="text-neutral-600">/ tells you which side is crowded</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">3.</span>
                <span className="text-white">Price stalls or reverses slightly</span>
                <span className="text-neutral-600">/ early sign of exhaustion</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-hub-yellow">4.</span>
                <span className="text-hub-yellow">OI starts dropping fast</span>
                <span className="text-neutral-600">/ the squeeze is on</span>
              </div>
            </div>

            <Callout type="example">
              <strong>Real-world pattern:</strong> BTC sitting at $85K, OI at record highs, funding deeply positive
              (longs paying 0.05%+ per 8h). Everyone and their grandma is leveraged long.
              Price dips 2%, funding stays high, then OI drops $2B in an hour.
              That&apos;s longs getting liquidated. Cascading liquidations push price lower, which liquidates more longs.
              You&apos;ve seen this movie before. OI told you it was coming.
            </Callout>

            <Callout type="warning">
              <strong>Timing is hard:</strong> Just because OI is at extremes doesn&apos;t mean the squeeze happens tomorrow.
              Markets can stay overleveraged for weeks. Use OI as a warning sign, not a precise entry trigger.
              Combine it with price action and funding rates for better timing.
            </Callout>
          </Section>

          <Section id="oi-divergence" title="5. OI divergence: the quiet warning sign">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              One of the most reliable OI signals is divergence, when OI and price start moving in
              opposite directions.
            </p>

            <h3 className="text-white font-semibold text-base mb-3">Bearish divergence</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              Price makes a new high, but OI is lower than it was at the previous high.
              Translation: fewer traders are willing to bet on higher prices at this level.
              Conviction is fading even though price looks strong on the surface.
              This often precedes a reversal.
            </p>

            <h3 className="text-white font-semibold text-base mb-3 mt-6">Bullish divergence</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              Price makes a new low, but OI is lower than it was at the previous low.
              Sellers are losing interest. The people who wanted to short have already shorted.
              There&apos;s less fuel for further downside. Watch for a bounce.
            </p>

            <Callout type="tip">
              <strong>Pro move:</strong> Check OI divergence on InfoHub&apos;s{' '}
              <Link href="/open-interest" className="text-hub-yellow hover:underline">/open-interest</Link> page.
              Compare the OI chart against price. If price is making new highs while total OI is declining,
              that&apos;s your cue to tighten stops or take some profit.
            </Callout>
          </Section>

          <Section id="using-infohub" title="6. Using InfoHub to read OI">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              InfoHub tracks open interest across <strong className="text-white">26+ exchanges</strong> and
              thousands of trading pairs. Here&apos;s how to use the tools:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-hub-yellow" />
                  Open Interest Dashboard
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  Head to <Link href="/open-interest" className="text-hub-yellow hover:underline">/open-interest</Link>.
                  You&apos;ll see total OI across all exchanges, broken down by exchange.
                  This is your starting point. It tells you where the money is.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Look at the exchange breakdown. If Binance holds 40% of BTC OI and suddenly their share drops
                  while OKX grows, traders are migrating. That matters for liquidity and funding dynamics.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-hub-yellow" />
                  OI + Price Overlay
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  The chart page at <Link href="/chart" className="text-hub-yellow hover:underline">/chart</Link> lets
                  you overlay OI data on top of the price chart. This is where you spot the four scenarios from section 3.
                  Look for the moments where OI and price diverge. Those are the setups.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-hub-yellow" />
                  Screener &amp; Heatmap
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  The <Link href="/screener" className="text-hub-yellow hover:underline">/screener</Link> lets you
                  filter coins by OI change. Sort by &quot;OI 24h Change&quot; to find which assets are seeing the biggest
                  influx (or outflow) of capital right now.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Use the <Link href="/funding-heatmap" className="text-hub-yellow hover:underline">/funding-heatmap</Link> alongside
                  OI data. If a coin has extreme funding AND rising OI, the trade is getting crowded.
                  That&apos;s your squeeze watchlist.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-hub-yellow" />
                  Combine with Liquidations
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Check <Link href="/liquidations" className="text-hub-yellow hover:underline">/liquidations</Link> while
                  watching OI. When you see OI dropping sharply at the same time as a spike in liquidations,
                  that confirms a forced-closure cascade. The drop in OI isn&apos;t voluntary. Traders are getting wiped out.
                  These moments often mark local tops or bottoms.
                </p>
              </div>
            </div>
          </Section>

          <Section id="common-mistakes" title="7. Common mistakes (and how to avoid them)">
            <div className="space-y-4 mb-4">
              {[
                {
                  mistake: 'Treating OI as directional',
                  fix: 'OI tells you how much leverage exists, not which direction. A $30B OI means $30B in longs AND $30B in shorts. Use long/short ratio and funding rates to figure out direction.',
                },
                {
                  mistake: 'Ignoring the exchange breakdown',
                  fix: 'Total OI can be misleading. If OI jumps $2B but it\'s all on one exchange, it might be a single whale or an institutional hedge. Check InfoHub\'s per-exchange OI breakdown.',
                },
                {
                  mistake: 'Looking at OI in isolation',
                  fix: 'OI is context-dependent. A $1B OI increase on BTC is normal. A $1B increase on DOGE is massive. Always compare to the asset\'s historical OI range and market cap.',
                },
                {
                  mistake: 'Confusing contract OI with USD OI',
                  fix: 'Some exchanges report OI in contracts, others in USD. When BTC price doubles, USD-denominated OI doubles too, even if no new positions were opened. InfoHub normalizes everything to USD for fair comparison.',
                },
                {
                  mistake: 'Forgetting about options OI',
                  fix: 'Futures OI gets all the attention, but options OI matters too, especially around expiry dates. Large options OI at specific strikes creates "magnetic" price levels (max pain). Check InfoHub\'s options page for this.',
                },
              ].map(({ mistake, fix }) => (
                <div key={mistake} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="text-red-400 font-semibold text-sm mb-1.5 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {mistake}
                  </h4>
                  <p className="text-neutral-400 text-xs leading-relaxed">{fix}</p>
                </div>
              ))}
            </div>

            <Callout type="warning">
              <strong>The biggest mistake of all:</strong> Using OI as a standalone trading signal.
              OI is a <em>context tool</em>, not a trigger. It tells you the state of the market.
              Combine it with price action, funding rates, and liquidation data to make actual trading decisions.
            </Callout>
          </Section>

          <Section id="cheatsheet" title="8. Quick reference cheatsheet">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm" aria-label="Open interest cheatsheet">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">OI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Signal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">What&apos;s happening</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['↑ Up', '↑ Up', 'Bullish', 'New longs entering. Trend has conviction.'],
                    ['↑ Up', '↓ Down', 'Weak rally', 'Short squeeze. Rally may stall soon.'],
                    ['↓ Down', '↑ Up', 'Bearish', 'New shorts entering. Trend has conviction.'],
                    ['↓ Down', '↓ Down', 'Weak sell-off', 'Long squeeze / capitulation. Bottom may be near.'],
                    ['→ Flat', '↑ Up', 'Coiling', 'Positions building. Big move coming, direction TBD.'],
                    ['→ Flat', '↓ Down', 'Losing interest', 'Traders closing out. Low volatility ahead.'],
                  ] as const).map(([price, oi, signal, desc], i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-white font-mono font-medium">{price}</td>
                      <td className="px-4 py-2.5 font-mono text-cyan-400">{oi}</td>
                      <td className={`px-4 py-2.5 font-semibold ${
                        signal === 'Bullish' ? 'text-green-400' :
                        signal === 'Bearish' ? 'text-red-400' :
                        'text-hub-yellow'
                      }`}>{signal}</td>
                      <td className="px-4 py-2.5 text-neutral-400 text-xs">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="tip">
              <strong>Bookmark this:</strong> Keep this cheatsheet handy while you trade.
              Every time price makes a big move, check what OI is doing.
              Within a few weeks you&apos;ll start reading the market like a completely different person.
            </Callout>
          </Section>

          {/* ─── Bottom CTA ─── */}
          <div className="mt-12 pt-8 border-t border-white/[0.06]">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
              <BarChart3 className="w-6 h-6 text-hub-yellow mx-auto mb-3" />
              <h3 className="text-white font-bold text-base mb-2">Start reading OI now</h3>
              <p className="text-neutral-500 text-sm mb-5 max-w-md mx-auto">
                InfoHub tracks open interest across 26+ exchanges in real-time.
                See exactly where the leverage is building.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/open-interest"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-hub-yellow text-black text-sm font-bold rounded-lg hover:bg-hub-yellow/90 transition-colors"
                >
                  Open Interest Dashboard
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-neutral-300 hover:text-white hover:border-white/[0.15] transition-all"
                >
                  More guides
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <ReferralBanner />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
