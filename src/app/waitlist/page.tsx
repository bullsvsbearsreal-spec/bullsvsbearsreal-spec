'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity, BarChart3, Zap, TrendingUp, GitCompareArrows,
  Shield, Building2, ChevronRight, ChevronDown,
  Check, Loader2, Send, Twitter, Globe, ArrowRight,
  Clock, Eye, Crosshair, LineChart,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Activity,
    title: 'Funding Rates',
    desc: 'Live rates across crypto, stocks, forex, and commodities. Heatmaps, arbitrage detection, and correlation matrices.',
    color: '#22c55e',
    stat: '8,600+',
    statLabel: 'pairs',
  },
  {
    icon: Zap,
    title: 'Liquidations',
    desc: 'WebSocket feeds streaming rekt events as they happen. Not delayed, not aggregated. The real tape.',
    color: '#ef4444',
    stat: '9',
    statLabel: 'live feeds',
  },
  {
    icon: BarChart3,
    title: 'Open Interest',
    desc: 'See where positions are building before the move. OI heatmaps and change tracking across all markets.',
    color: '#8b5cf6',
    stat: '$70B+',
    statLabel: 'tracked',
  },
  {
    icon: TrendingUp,
    title: 'Screener',
    desc: 'Filter 1,200+ symbols by funding, OI, volume, price. Auto sentiment: PUMPING, FLUSHING, PANIC, CROWDED.',
    color: '#3b82f6',
    stat: '1,200+',
    statLabel: 'symbols',
  },
  {
    icon: GitCompareArrows,
    title: 'Prediction Arb',
    desc: 'Cross-platform arbitrage between Polymarket and Kalshi. Matched events with spread and profit calculations.',
    color: '#f59e0b',
    stat: '210+',
    statLabel: 'markets',
  },
  {
    icon: Shield,
    title: 'Options & ETF',
    desc: 'Options from Deribit, Binance, Bybit, OKX. All US spot Bitcoin and Ethereum ETFs with live quotes.',
    color: '#06b6d4',
    stat: '17',
    statLabel: 'ETFs',
  },
];

const MORE_TOOLS = [
  { icon: Crosshair, name: 'Liquidation Map', color: '#ef4444' },
  { icon: LineChart, name: 'CVD Analysis', color: '#8b5cf6' },
  { icon: Eye, name: 'Whale Tracker', color: '#06b6d4' },
  { icon: Clock, name: 'Economic Calendar', color: '#f59e0b' },
  { icon: Globe, name: 'Market Heatmap', color: '#22c55e' },
  { icon: BarChart3, name: 'Dominance', color: '#3b82f6' },
];

const EXCHANGES_ROW = [
  'Binance', 'Bybit', 'OKX', 'Hyperliquid', 'Bitget', 'MEXC', 'Kraken',
  'dYdX', 'GMX', 'gTrade', 'BingX', 'KuCoin', 'Drift', 'Aevo',
  'Coinbase', 'Lighter', 'HTX', 'Phemex', 'Variational', 'Bitunix',
  'WhiteBIT', 'CoinEx', 'Bitfinex', 'Extended', 'Aster', 'Nado',
  'edgeX', 'Backpack', 'Paradex', 'Orderly', 'Deribit',
];

const FAQS = [
  {
    q: 'What is InfoHub?',
    a: 'InfoHub is a real-time crypto derivatives intelligence platform. We aggregate funding rates, liquidations, open interest, options data, and more from 33+ exchanges (both centralized and decentralized) into a single dashboard built for serious traders.',
  },
  {
    q: 'When does it launch?',
    a: 'Very soon. We\'re in the final testing phase. Join the waitlist to be the first to know when we go live.',
  },
  {
    q: 'How much will it cost?',
    a: 'We\'ll launch with a generous free tier covering core features like funding rates, OI, and liquidation feeds. Premium plans with advanced tools, historical data, API access, and custom alerts will be available at competitive pricing.',
  },
  {
    q: 'Which exchanges do you cover?',
    a: '33 exchanges: 18 CEX (Binance, Bybit, OKX, Bitget, MEXC, Kraken, Coinbase, KuCoin, HTX, and more) plus 15 DEX protocols (Hyperliquid, dYdX, GMX, gTrade, Drift, Aevo, Lighter, Variational, and others). More being added regularly.',
  },
  {
    q: 'What makes InfoHub different?',
    a: 'Three things: (1) We cover 15 DEX protocols that most competitors miss entirely. (2) We include prediction market arbitrage scanning across Polymarket and Kalshi. (3) Our funding rate analysis goes deeper with correlation matrices, arbitrage detection, and OI-weighted averages across all asset classes.',
  },
  {
    q: 'Can I get early access?',
    a: 'Join the waitlist above. We\'re rolling out access in batches and waitlist members get priority.',
  },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  // Animated counter on mount
  useEffect(() => {
    const target = 33;
    const step = Math.ceil(target / 20);
    const interval = setInterval(() => {
      setCount(prev => {
        if (prev + step >= target) { clearInterval(interval); return target; }
        return prev + step;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || "You're on the list!");
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-xl font-black">Info<span className="text-hub-yellow">Hub</span></span>
          <div className="flex items-center gap-3">
            <a href="https://x.com/info_hub69" target="_blank" rel="noopener noreferrer" className="text-neutral-700 hover:text-hub-yellow transition-colors" aria-label="X/Twitter">
              <Twitter className="w-3.5 h-3.5" />
            </a>
            <a href="https://t.me/+Z6SQGJ57SlwyY2Rk" target="_blank" rel="noopener noreferrer" className="text-neutral-700 hover:text-hub-yellow transition-colors" aria-label="Telegram">
              <Send className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-12 sm:pt-32 sm:pb-20 px-4 sm:px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-hub-yellow/[0.03] rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-purple-500/[0.02] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-hub-yellow animate-pulse" />
            <span className="text-hub-yellow text-sm font-bold">Launching Soon</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
            The derivatives<br />dashboard you<br />
            <span className="text-hub-yellow">actually need</span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-400 max-w-lg mx-auto mb-10 leading-relaxed">
            Funding rates, liquidations, open interest, and prediction market arbitrage from{' '}
            <span className="text-white font-bold">{count} exchanges</span>.
            Real-time. No fluff.
          </p>

          {/* Email Form */}
          {status === 'success' ? (
            <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-green-500/10 border border-green-500/20">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-green-400 font-bold text-xl">{message}</p>
              <p className="text-green-400/60 text-sm">Check your inbox. We'll notify you at launch.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  autoComplete="email"
                  className="flex-1 px-5 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-neutral-600 text-[15px] focus:outline-none focus:border-hub-yellow/50 focus:ring-2 focus:ring-hub-yellow/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-8 py-3.5 rounded-xl bg-hub-yellow text-black font-bold text-[15px] hover:bg-hub-yellow/90 hover:shadow-[0_0_20px_rgba(255,165,0,0.2)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Get Early Access <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
              {status === 'error' && (
                <p className="text-red-400 text-sm mt-3">{message}</p>
              )}
              <p className="text-neutral-700 text-xs mt-4">No spam, ever. Just one email when we launch.</p>
            </form>
          )}
        </div>
      </section>

      {/* Scrolling Exchange Logos */}
      <section className="py-6 border-y border-white/[0.04] overflow-hidden">
        <div className="flex animate-ticker">
          {[...EXCHANGES_ROW, ...EXCHANGES_ROW].map((ex, i) => (
            <span key={`${ex}-${i}`} className="flex-shrink-0 px-4 py-1 text-neutral-600 text-xs font-medium whitespace-nowrap">
              {ex}
            </span>
          ))}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '33', label: 'Exchanges', sub: '18 CEX + 15 DEX' },
            { value: '8,600+', label: 'Trading Pairs', sub: 'All asset classes' },
            { value: '$70B+', label: 'Open Interest', sub: 'Tracked in real-time' },
            { value: '<2s', label: 'Update Speed', sub: 'WebSocket feeds' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-black font-mono text-hub-yellow">{s.value}</div>
              <div className="text-sm text-white font-semibold mt-1">{s.label}</div>
              <div className="text-[10px] text-neutral-600 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">
              Built for traders, not tourists
            </h2>
            <p className="text-neutral-500 max-w-md mx-auto">
              Every tool you need to trade derivatives. One dashboard. Real-time data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group rounded-2xl p-6 border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${f.color}12` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{f.title}</h3>
                    <span className="text-xs font-mono font-bold" style={{ color: f.color }}>{f.stat} <span className="text-neutral-600 font-normal">{f.statLabel}</span></span>
                  </div>
                </div>
                <p className="text-neutral-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* More tools row */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {MORE_TOOLS.map(t => (
              <div key={t.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                <span className="text-xs text-neutral-400 font-medium">{t.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <span className="text-xs text-neutral-600">+ 20 more tools</span>
            </div>
          </div>
        </div>
      </section>

      {/* Exchange Coverage */}
      <section className="py-16 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">
              <span className="text-hub-yellow">33</span> exchanges. Zero blind spots.
            </h2>
            <p className="text-neutral-500">CEX and DEX coverage that actually matters for derivatives.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/[0.06] p-5 bg-white/[0.015]">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-hub-yellow" />
                <span className="text-sm font-bold text-white">Centralized Exchanges</span>
                <span className="text-xs text-hub-yellow/60 bg-hub-yellow/10 px-2 py-0.5 rounded font-bold">18</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC', 'Kraken', 'BingX', 'KuCoin', 'HTX', 'Coinbase', 'Phemex', 'Bitunix', 'WhiteBIT', 'CoinEx', 'Bitfinex', 'Deribit', 'Gate.io', 'BitMEX'].map(ex => (
                  <span key={ex} className="px-2 py-1 rounded-md bg-white/[0.04] text-neutral-400 text-[11px] font-medium">
                    {ex}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] p-5 bg-white/[0.015]">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Decentralized Protocols</span>
                <span className="text-xs text-purple-400/60 bg-purple-400/10 px-2 py-0.5 rounded font-bold">15</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Hyperliquid', 'dYdX', 'GMX', 'gTrade', 'Drift', 'Aevo', 'Lighter', 'Variational', 'Extended', 'Aster', 'Nado', 'edgeX', 'Backpack', 'Paradex', 'Orderly'].map(ex => (
                  <span key={ex} className="px-2 py-1 rounded-md bg-white/[0.04] text-neutral-400 text-[11px] font-medium">
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-white/[0.06] overflow-hidden bg-white/[0.015]">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-white font-semibold text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 border-t border-white/[0.04]">
                    <p className="text-neutral-400 text-sm leading-relaxed pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/[0.04] relative">
        <div className="absolute inset-0 bg-gradient-to-t from-hub-yellow/[0.02] to-transparent pointer-events-none" />
        <div className="relative max-w-xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Ready to trade smarter?
          </h2>
          <p className="text-neutral-500 mb-8">Be first in line when InfoHub launches.</p>

          {status === 'success' ? (
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-bold">You're on the list!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  autoComplete="email"
                  className="flex-1 px-5 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-neutral-600 text-[15px] focus:outline-none focus:border-hub-yellow/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-8 py-3.5 rounded-xl bg-hub-yellow text-black font-bold text-[15px] hover:bg-hub-yellow/90 transition-all disabled:opacity-50"
                >
                  {status === 'loading' ? 'Joining...' : 'Get Early Access'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">Info<span className="text-hub-yellow">Hub</span></span>
            <span className="text-neutral-700 text-xs">&copy; {new Date().getFullYear()}</span>
            <span className="text-neutral-800">|</span>
            <span className="text-neutral-700 text-[10px]">Real-time crypto derivatives intelligence</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://x.com/info_hub69" target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-hub-yellow transition-colors" aria-label="X/Twitter">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="https://t.me/+Z6SQGJ57SlwyY2Rk" target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-hub-yellow transition-colors" aria-label="Telegram">
              <Send className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
