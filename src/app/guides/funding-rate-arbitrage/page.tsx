import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Clock, BookOpen, AlertTriangle, CheckCircle2, ExternalLink, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Funding Rate Arbitrage Guide | InfoHub',
  description: 'Learn how to profit from funding rate differences across exchanges. Step-by-step guide to spot and execute funding rate arbitrage.',
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

export default function FundingRateArbitragePage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto">

          {/* Back link + breadcrumb */}
          <Link href="/guides" className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-hub-yellow text-sm mb-6 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Guides
          </Link>

          {/* Hero */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-neutral-500 border border-white/[0.06]">Strategy</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border text-hub-yellow bg-hub-yellow/10 border-hub-yellow/20">Intermediate</span>
              <span className="text-[10px] text-neutral-600 flex items-center gap-1"><Clock className="w-3 h-3" /> 12 min read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              Funding Rate Arbitrage
            </h1>
            <p className="text-neutral-400 text-base leading-relaxed">
              The strategy that lets you profit from funding rate differences across exchanges &mdash;
              regardless of which way the market moves. Here&apos;s exactly how it works,
              when it works, and when it doesn&apos;t.
            </p>
          </div>

          {/* Table of contents */}
          <nav className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 mb-10">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">In this guide</h3>
            <ol className="space-y-1.5 text-sm">
              {[
                ['what-is-funding', 'What are funding rates?'],
                ['how-arb-works', 'How funding rate arbitrage works'],
                ['step-by-step', 'Step-by-step execution'],
                ['finding-opportunities', 'Finding opportunities on InfoHub'],
                ['real-numbers', 'Real numbers: what to expect'],
                ['risks', 'Risks and gotchas'],
                ['advanced', 'Advanced: multi-leg and cross-exchange'],
                ['checklist', 'Pre-trade checklist'],
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

          <Section id="what-is-funding" title="1. What are funding rates?">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Perpetual futures don&apos;t have an expiry date, so they need a mechanism to stay anchored to the spot price.
              That mechanism is the <strong className="text-white">funding rate</strong> &mdash; a periodic payment between longs and shorts.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 my-5">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-bold">Positive funding</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Longs pay shorts. The perp is trading <em>above</em> spot. Market is bullish/overleveraged to the upside.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-sm font-bold">Negative funding</span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Shorts pay longs. The perp is trading <em>below</em> spot. Market is bearish/overleveraged to the downside.
                </p>
              </div>
            </div>
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              Most exchanges settle funding every <strong className="text-white">8 hours</strong> (00:00, 08:00, 16:00 UTC).
              Some DEXes like Hyperliquid and Drift settle <strong className="text-white">hourly</strong>.
              gTrade accrues continuously per block.
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Typical rates range from <span className="text-green-400 font-mono">+0.01%</span> to <span className="text-red-400 font-mono">-0.01%</span> per 8h in calm markets.
              During high volatility, rates can spike to <span className="text-hub-yellow font-mono">0.1%+</span> per 8h &mdash;
              that&apos;s <strong className="text-white">4.5% per day</strong> annualized.
            </p>
          </Section>

          <Section id="how-arb-works" title="2. How funding rate arbitrage works">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              The core idea is simple: <strong className="text-white">collect funding payments while being market-neutral</strong>.
              You do this by holding opposite positions that cancel out price risk.
            </p>

            <h3 className="text-white font-semibold text-base mb-3">Type 1: Spot-Perp Arbitrage (Cash & Carry)</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              When funding is positive (longs paying shorts):
            </p>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-4 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">1.</span>
                <span className="text-white">Buy spot BTC</span>
                <span className="text-neutral-600">&mdash; you own the asset</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">2.</span>
                <span className="text-white">Short BTC perp (same size)</span>
                <span className="text-neutral-600">&mdash; you&apos;re delta neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-hub-yellow">3.</span>
                <span className="text-hub-yellow">Collect funding every 8h</span>
                <span className="text-neutral-600">&mdash; longs pay you</span>
              </div>
            </div>

            <Callout type="tip">
              <strong>Why it works:</strong> If BTC goes up, your spot gains offset your perp losses. If BTC goes down, your perp gains offset your spot losses.
              Either way, you keep the funding payments.
            </Callout>

            <h3 className="text-white font-semibold text-base mb-3 mt-6">Type 2: Cross-Exchange Perp Arbitrage</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              When the same asset has <em>different</em> funding rates on two exchanges:
            </p>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-4 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">1.</span>
                <span className="text-white">Short on Exchange A</span>
                <span className="text-neutral-600">&mdash; high positive funding (you receive)</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">2.</span>
                <span className="text-white">Long on Exchange B</span>
                <span className="text-neutral-600">&mdash; low/negative funding (you pay less or receive)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-hub-yellow">3.</span>
                <span className="text-hub-yellow">Net funding = Exchange A rate - Exchange B rate</span>
              </div>
            </div>

            <Callout type="example">
              <strong>Example:</strong> ETH funding on Binance is +0.05%/8h, on Hyperliquid it&apos;s -0.01%/1h (-0.08%/8h).
              Short Binance (+0.05%), Long Hyperliquid (+0.08%) = <strong>+0.13%/8h net</strong> = 0.39%/day = <strong>~142% APR</strong>.
            </Callout>
          </Section>

          <Section id="step-by-step" title="3. Step-by-step execution">
            <div className="space-y-4">
              {[
                { step: 1, title: 'Scan for spread', desc: 'Go to /funding on InfoHub. Switch to Arbitrage view. Sort by spread descending. Look for pairs where the funding difference is > 0.03%/8h (after fees).' },
                { step: 2, title: 'Check liquidity', desc: 'Verify both exchanges have sufficient depth for your position size. Check OI on /open-interest. Thin markets = slippage = lost edge.' },
                { step: 3, title: 'Calculate net after fees', desc: 'Trading fees (taker: ~0.04-0.06%), funding fees, and borrowing costs eat into your spread. The net must be positive after ALL costs.' },
                { step: 4, title: 'Open positions simultaneously', desc: 'Speed matters. Open both legs at the same time (or within seconds). Use limit orders if possible to reduce taker fees. Same notional size on both sides.' },
                { step: 5, title: 'Monitor and rebalance', desc: 'Check funding rates every 8h. If the spread closes or inverts, close both positions. Watch for liquidation risk on the losing side.' },
                { step: 6, title: 'Close when spread dies', desc: 'Funding rates mean-revert. When the spread narrows below your fee threshold, close both sides and take profit.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0 text-hub-yellow font-bold text-sm">
                    {step}
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm mb-1">{title}</h4>
                    <p className="text-neutral-400 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="finding-opportunities" title="4. Finding opportunities on InfoHub">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              InfoHub aggregates funding rates from <strong className="text-white">30+ exchanges</strong> in real-time.
              Here&apos;s how to use it to find arb opportunities:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-hub-yellow" />
                  Funding Arbitrage View
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                  Go to <Link href="/funding" className="text-hub-yellow hover:underline">/funding</Link> and click the <strong className="text-white">Arbitrage</strong> tab.
                  This shows the highest and lowest funding rates for each symbol across all exchanges, with the spread calculated for you.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Sort by spread to find the juiciest opportunities. Look for spreads &gt; 0.03%/8h on major coins (BTC, ETH, SOL) with good liquidity on both sides.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-hub-yellow" />
                  Funding Heatmap
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  The <Link href="/funding-heatmap" className="text-hub-yellow hover:underline">/funding-heatmap</Link> shows 7-day funding trends per symbol.
                  Look for symbols where one exchange is consistently deep green (positive) while another is deep red (negative).
                  Persistent divergence = sustainable arb.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-hub-yellow" />
                  Screener Filters
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Use the <Link href="/screener" className="text-hub-yellow hover:underline">/screener</Link> with &quot;High Funding&quot; or &quot;Negative Funding&quot; presets
                  to quickly find symbols with extreme rates. Cross-reference with OI to ensure there&apos;s enough liquidity.
                </p>
              </div>
            </div>
          </Section>

          <Section id="real-numbers" title="5. Real numbers: what to expect">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm" aria-label="Funding rate arbitrage scenarios">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Scenario</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500">Spread /8h</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500">Daily</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500">APR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500">On $10K</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Calm market', '0.01%', '0.03%', '~11%', '$3/day'],
                    ['Mild divergence', '0.03%', '0.09%', '~33%', '$9/day'],
                    ['Strong divergence', '0.05%', '0.15%', '~55%', '$15/day'],
                    ['Extreme (rare)', '0.10%+', '0.30%+', '~110%+', '$30+/day'],
                  ].map(([scenario, spread, daily, apr, profit], i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-white font-medium">{scenario}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-400">{spread}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-neutral-300">{daily}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-hub-yellow font-bold">{apr}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-neutral-400">{profit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="warning">
              <strong>Reality check:</strong> These are gross numbers before fees. After trading fees (~0.04% per trade x 4 trades = 0.16%),
              slippage, and funding payment timing, your net is roughly <strong>50-70%</strong> of the gross spread.
              A 0.03%/8h spread nets about 0.01-0.02%/8h after costs.
            </Callout>
          </Section>

          <Section id="risks" title="6. Risks and gotchas">
            <div className="space-y-3">
              {[
                { title: 'Funding rate inversion', desc: 'The rate can flip against you. What was +0.05%/8h can become -0.05%/8h in one settlement. Always have stop-loss levels.', severity: 'high' },
                { title: 'Liquidation on one leg', desc: 'If the price moves sharply, one side of your arb can get liquidated while the other side stays open. Now you\'re exposed. Use low leverage (2-3x max).', severity: 'high' },
                { title: 'Exchange counterparty risk', desc: 'Your funds are on two different exchanges. If one gets hacked or pauses withdrawals, you\'re stuck with a one-sided position.', severity: 'medium' },
                { title: 'Slippage on entry/exit', desc: 'Opening and closing both legs simultaneously is hard. Even a few seconds delay means slippage, especially on volatile assets.', severity: 'medium' },
                { title: 'Capital inefficiency', desc: 'You need margin on two exchanges. With 3x leverage, a $10K arb ties up ~$6.7K in margin. During that time, your capital isn\'t earning elsewhere.', severity: 'low' },
                { title: 'Withdrawal delays', desc: 'If you need to rebalance margin between exchanges, blockchain confirmations can take 10-60 minutes. The arb might close before your transfer arrives.', severity: 'medium' },
              ].map(({ title, desc, severity }) => (
                <div key={title} className="flex gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    severity === 'high' ? 'bg-red-400' : severity === 'medium' ? 'bg-yellow-400' : 'bg-neutral-500'
                  }`} />
                  <div>
                    <h4 className="text-white font-semibold text-sm mb-1">{title}</h4>
                    <p className="text-neutral-400 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="advanced" title="7. Advanced: multi-leg and cross-exchange">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Once you&apos;re comfortable with basic funding arb, here are ways to scale:
            </p>

            <h3 className="text-white font-semibold text-base mb-3">CEX vs DEX arbitrage</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              DEXes (Hyperliquid, dYdX, Drift) often have different funding dynamics than CEXes (Binance, Bybit, OKX).
              DEX funding is driven by smaller, more volatile pools &mdash; creating bigger spreads.
              The trade-off is higher gas costs and slower execution.
            </p>

            <h3 className="text-white font-semibold text-base mb-3">Multi-asset rotation</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Don&apos;t stick to one pair. Rotate between whichever symbol has the best spread today.
              Use the InfoHub <Link href="/funding" className="text-hub-yellow hover:underline">Arbitrage view</Link> to scan all symbols at once.
              Altcoins often have wider spreads than BTC/ETH but with thinner liquidity.
            </p>

            <h3 className="text-white font-semibold text-base mb-3">Funding rate mean reversion</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Extreme funding rates tend to snap back. When you see funding at 0.1%+ on an asset, it often corrects within 24-48 hours.
              Timing the entry at peak funding and exiting as it normalizes captures both the funding payments AND the convergence.
            </p>
          </Section>

          <Section id="checklist" title="8. Pre-trade checklist">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="space-y-3">
                {[
                  'Funding spread > 0.03%/8h after fees on both sides',
                  'Sufficient OI and depth on both exchanges (check /open-interest)',
                  'Leverage set to 2-3x max (never higher for arb)',
                  'Position sizes equal on both legs (USD notional, not token count)',
                  'Margin available on both exchanges before opening',
                  'Stop-loss plan if funding inverts (how much loss will you tolerate?)',
                  'Withdrawal routes confirmed (can you move funds between exchanges fast?)',
                  'Not entering during extreme volatility (high slippage risk)',
                  'Tracking spreadsheet ready (entry rates, fees, P&L per settlement)',
                ].map((item, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <div className="w-4 h-4 rounded border border-white/[0.15] flex-shrink-0 mt-0.5 group-hover:border-hub-yellow/40 transition-colors" />
                    <span className="text-neutral-300 text-sm leading-relaxed group-hover:text-white transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </Section>

          {/* CTA */}
          <div className="bg-hub-yellow/5 border border-hub-yellow/20 rounded-xl p-6 text-center mb-8">
            <h3 className="text-white font-bold text-lg mb-2">Ready to scan for arb?</h3>
            <p className="text-neutral-400 text-sm mb-4">
              InfoHub shows live funding rates from 30+ exchanges. The Arbitrage view calculates spreads for you.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/funding" className="inline-flex items-center gap-2 px-5 py-2.5 bg-hub-yellow text-black text-sm font-bold rounded-lg hover:bg-hub-yellow/90 transition-colors">
                Open Funding Rates <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link href="/screener" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-neutral-300 rounded-lg hover:text-white hover:border-white/[0.15] transition-all">
                Screener
              </Link>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center border-t border-white/[0.06] pt-6">
            <p className="text-neutral-700 text-[10px] leading-relaxed max-w-lg mx-auto">
              This guide is for educational purposes only and does not constitute financial advice.
              Funding rate arbitrage involves real financial risk including potential loss of capital.
              Always do your own research and trade responsibly.
            </p>
          </div>

        </div>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
