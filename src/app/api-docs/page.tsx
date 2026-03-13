import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Code2, ArrowRight, Zap, Shield, Clock, Database, Key, BookOpen } from 'lucide-react';

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/funding', desc: 'Live funding rates across all exchanges' },
  { method: 'GET', path: '/api/v1/arbitrage', desc: 'Funding rate arbitrage opportunities' },
  { method: 'GET', path: '/api/v1/openinterest', desc: 'Open interest aggregated by symbol' },
  { method: 'GET', path: '/api/v1/funding/history', desc: 'Historical funding rate snapshots' },
  { method: 'GET', path: '/api/v1/exchanges', desc: 'Exchange metadata, fees, and status' },
  { method: 'GET', path: '/api/v1/status', desc: 'API health and data freshness (no auth)' },
];

const FEATURES = [
  { icon: Zap, title: 'Real-time Data', desc: 'Funding rates, OI, and arbitrage opportunities refreshed every 60 seconds across 30+ exchanges' },
  { icon: Shield, title: 'Authenticated', desc: 'Secure API key authentication with per-key rate limiting and usage tracking' },
  { icon: Clock, title: 'Rate Limited', desc: 'Free tier: 100 req/min, 5,000/day. Pro tier: 500 req/min, 50,000/day' },
  { icon: Database, title: '24+ Exchanges', desc: 'CEX and DEX coverage — Binance, Bybit, OKX, Hyperliquid, dYdX, GMX, and more' },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[900px] mx-auto px-4 sm:px-6">
        {/* Hero */}
        <section className="relative py-16 sm:py-24 text-center overflow-hidden">
          <div className="absolute inset-0 hero-mesh opacity-60 pointer-events-none" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgb(var(--hub-accent-rgb) / 0.06) 0%, transparent 70%)' }}
          />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              InfoHub{' '}
              <span className="text-gradient">Public API</span>
            </h1>

            <p className="text-neutral-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
              Programmatic access to funding rates, open interest, and arbitrage
              opportunities across 30+ exchanges. Built for trading bots and dashboards.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/developers"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all"
              >
                <Key size={15} />
                Get API Key
              </Link>
              <Link
                href="/developers/docs"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm transition-all"
              >
                <BookOpen size={15} />
                Full Documentation
              </Link>
            </div>
          </div>
        </section>

        <div className="accent-line mb-12" />

        {/* Features */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 group hover:border-white/[0.1] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-hub-yellow/10 flex items-center justify-center mb-3">
                <f.icon className="w-4.5 h-4.5 text-hub-yellow" size={18} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Endpoints */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Endpoints</h2>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                <span className="flex-shrink-0 text-[10px] font-bold tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                  {ep.method}
                </span>
                <code className="text-xs text-neutral-300 font-mono truncate">{ep.path}</code>
                <span className="hidden sm:block ml-auto text-xs text-neutral-600 truncate max-w-[250px]">{ep.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Start */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Quick Start</h2>
          <div className="rounded-xl border border-white/[0.06] bg-black/30 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="w-2 h-2 rounded-full bg-red-500/60" />
              <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
              <span className="w-2 h-2 rounded-full bg-green-500/60" />
              <span className="ml-2 text-[10px] text-neutral-600 font-mono">curl</span>
            </div>
            <pre className="p-4 sm:p-5 text-xs sm:text-sm text-green-400 font-mono overflow-x-auto leading-relaxed">
{`curl -H "Authorization: Bearer ih_your_key_here" \\
  "https://infohub.dev/api/v1/funding?symbol=BTC"`}
            </pre>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-12">
          <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
            <div className="absolute inset-0 bg-gradient-to-br from-hub-yellow/[0.04] via-transparent to-hub-orange/[0.04]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/30 to-transparent" />

            <div className="relative p-6 sm:p-8 text-center">
              <h3 className="text-lg font-bold text-white mb-2">Ready to build?</h3>
              <p className="text-neutral-500 text-sm mb-5 max-w-md mx-auto">
                Create an account, generate an API key, and start pulling data in under a minute.
              </p>
              <Link
                href="/developers"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all"
              >
                Go to Developer Dashboard
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
