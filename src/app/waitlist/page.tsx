'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Activity, BarChart3, Zap, TrendingUp, GitCompareArrows, Newspaper,
  Shield, ArrowLeftRight, Layers, Building2, ChevronRight,
  Check, Loader2, Send, Twitter, Globe,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Activity,
    title: 'Funding Rates',
    desc: 'Real-time rates from 33 exchanges. Crypto, stocks, forex, commodities. 8,600+ pairs in one view.',
    color: '#22c55e',
    stat: '8,600+',
    statLabel: 'pairs tracked',
  },
  {
    icon: Zap,
    title: 'Live Liquidations',
    desc: 'WebSocket feeds from 9 exchanges. Watch the rekt tape roll in real-time during cascades.',
    color: '#ef4444',
    stat: '9',
    statLabel: 'live exchanges',
  },
  {
    icon: BarChart3,
    title: 'Open Interest',
    desc: '$70B+ tracked across 28 exchanges. See where positions build before the move happens.',
    color: '#8b5cf6',
    stat: '$70B+',
    statLabel: 'OI tracked',
  },
  {
    icon: TrendingUp,
    title: 'Screener & Sentiment',
    desc: '1,200+ symbols filterable by funding, OI, volume. Auto-labeled: PUMPING, FLUSHING, PANIC.',
    color: '#3b82f6',
    stat: '1,200+',
    statLabel: 'symbols',
  },
  {
    icon: GitCompareArrows,
    title: 'Prediction Market Arb',
    desc: 'Cross-platform arbitrage scanner. Polymarket vs Kalshi spread detection with profit calcs.',
    color: '#f59e0b',
    stat: '2',
    statLabel: 'platforms',
  },
  {
    icon: Shield,
    title: 'Options & ETF',
    desc: 'Options data from 4 exchanges. All US spot Bitcoin & Ethereum ETFs. Max pain, P/C ratios.',
    color: '#06b6d4',
    stat: '17',
    statLabel: 'ETFs tracked',
  },
];

const EXCHANGES_CEX = ['Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC', 'Kraken', 'BingX', 'KuCoin', 'HTX', 'Coinbase', 'Phemex', 'Bitunix', 'WhiteBIT', 'CoinEx', 'Bitfinex'];
const EXCHANGES_DEX = ['Hyperliquid', 'dYdX', 'GMX', 'gTrade', 'Drift', 'Aevo', 'Lighter', 'Variational', 'Extended', 'Aster', 'Nado', 'edgeX', 'Backpack', 'Paradex', 'Orderly'];

const FAQS = [
  { q: 'What is InfoHub?', a: 'A real-time crypto derivatives dashboard that aggregates funding rates, liquidations, open interest, and more from 33+ exchanges into one place.' },
  { q: 'When does it launch?', a: 'We\'re in the final stages. Join the waitlist to be notified the moment we go live.' },
  { q: 'Will it be free?', a: 'We\'ll offer a generous free tier with core features. Premium plans with advanced tools, alerts, and API access are coming too.' },
  { q: 'Which exchanges do you cover?', a: '33 exchanges total: 18 centralized (Binance, Bybit, OKX, etc.) and 15 decentralized (Hyperliquid, dYdX, GMX, gTrade, and more).' },
  { q: 'How is this different from Coinglass?', a: 'We cover more DEX protocols (15 vs ~5), include prediction market arbitrage, and offer deeper funding rate analysis with correlation matrices and arbitrage detection.' },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
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
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black">Info<span className="text-hub-yellow">Hub</span></span>
          </div>
          <Link
            href="/login"
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Existing users
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-hub-yellow/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-hub-yellow animate-pulse" />
            <span className="text-hub-yellow text-xs font-semibold">Coming Soon</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 leading-[1.1]">
            Real-Time Crypto<br />
            <span className="text-hub-yellow">Derivatives Intelligence</span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Funding rates, liquidations, open interest, and more from
            <span className="text-white font-semibold"> 33 exchanges</span>.
            Built for traders who need data that actually matters.
          </p>

          {/* Waitlist Form */}
          {status === 'success' ? (
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-green-500/10 border border-green-500/20">
              <Check className="w-6 h-6 text-green-400" />
              <div className="text-left">
                <p className="text-green-400 font-bold text-lg">{message}</p>
                <p className="text-green-400/60 text-sm">We'll email you when we launch.</p>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-hub-yellow/50 focus:ring-1 focus:ring-hub-yellow/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-6 py-3 rounded-xl bg-hub-yellow text-black font-bold text-sm hover:bg-hub-yellow/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Join Waitlist</>
                  )}
                </button>
              </div>
              {status === 'error' && (
                <p className="text-red-400 text-sm mt-2">{message}</p>
              )}
              <p className="text-neutral-600 text-xs mt-3">No spam. Just a launch notification.</p>
            </form>
          )}

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-12">
            {[
              { value: '33', label: 'Exchanges' },
              { value: '8,600+', label: 'Pairs' },
              { value: '$70B+', label: 'OI Tracked' },
              { value: '15', label: 'DEX Protocols' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-black font-mono text-white">{s.value}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-3">
            Everything derivatives traders need
          </h2>
          <p className="text-neutral-500 text-center mb-12 max-w-lg mx-auto">
            One dashboard to replace ten tabs. Real-time data across every major exchange.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group relative rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed mb-3">{f.desc}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black font-mono" style={{ color: f.color }}>{f.stat}</span>
                  <span className="text-neutral-600 text-xs">{f.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exchange Coverage */}
      <section className="py-16 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">
            33 exchanges. <span className="text-hub-yellow">Zero blind spots.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CEX */}
            <div className="rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-hub-yellow" />
                <span className="text-sm font-bold text-white">Centralized ({EXCHANGES_CEX.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXCHANGES_CEX.map(ex => (
                  <span key={ex} className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-neutral-300 text-xs font-medium border border-white/[0.06]">
                    {ex}
                  </span>
                ))}
              </div>
            </div>

            {/* DEX */}
            <div className="rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Decentralized ({EXCHANGES_DEX.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXCHANGES_DEX.map(ex => (
                  <span key={ex} className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-neutral-300 text-xs font-medium border border-white/[0.06]">
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
          <h2 className="text-2xl font-black text-center mb-8">FAQ</h2>
          <div className="space-y-2">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-white/[0.06] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-white font-semibold text-sm">{faq.q}</span>
                  <ChevronRight className={`w-4 h-4 text-neutral-500 transition-transform ${openFaq === idx ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4">
                    <p className="text-neutral-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-4">
            Don't miss the launch
          </h2>
          <p className="text-neutral-500 mb-6">Join the waitlist and be first in line.</p>

          {status === 'success' ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-semibold text-sm">You're on the list!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-hub-yellow/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-6 py-3 rounded-xl bg-hub-yellow text-black font-bold text-sm hover:bg-hub-yellow/90 transition-all disabled:opacity-50"
                >
                  {status === 'loading' ? 'Joining...' : 'Join Waitlist'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">Info<span className="text-hub-yellow">Hub</span></span>
            <span className="text-neutral-600 text-xs">&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://x.com/info_hub69" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="https://t.me/+Z6SQGJ57SlwyY2Rk" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors">
              <Send className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
