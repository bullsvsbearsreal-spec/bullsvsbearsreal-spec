'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  ArrowRight, Zap, Shield, Clock, Database, Key, BookOpen,
  Activity, TrendingUp, BarChart3, Layers, GitCompare, Scale,
  Flame, LineChart, Globe, Gauge, History, Server, AlertCircle,
  Copy, Check, ChevronRight, Code2, Terminal,
} from 'lucide-react';

/* ── Copy button ── */
function CopyBtn({ text, className = '' }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text.trim()); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className={`text-gray-600 hover:text-gray-300 transition-colors bg-black/40 backdrop-blur-sm border border-white/[0.06] rounded-md p-1.5 ${className}`}
      title="Copy"
    >
      {ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ── Code tabs ── */
const CODE_EXAMPLES = {
  curl: {
    label: 'cURL',
    icon: Terminal,
    code: `curl -s -H "Authorization: Bearer ih_your_key" \\
  "https://info-hub.io/api/v1/funding?symbols=BTC,ETH"`,
  },
  python: {
    label: 'Python',
    icon: Code2,
    code: `import requests

r = requests.get(
    "https://info-hub.io/api/v1/funding",
    headers={"Authorization": "Bearer ih_your_key"},
    params={"symbols": "BTC,ETH"}
)
data = r.json()["data"]
for row in data:
    print(f"{row['exchange']:12} {row['symbol']}  {row['rate']:+.4f}%")`,
  },
  node: {
    label: 'Node.js',
    icon: Code2,
    code: `const res = await fetch(
  "https://info-hub.io/api/v1/funding?symbols=BTC,ETH",
  { headers: { Authorization: "Bearer ih_your_key" } }
);
const { data } = await res.json();
data.forEach(r =>
  console.log(\`\${r.exchange}  \${r.symbol}  \${r.rate}%\`)
);`,
  },
};

type Lang = keyof typeof CODE_EXAMPLES;

/* ── Stats counter ── */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{value}</div>
      <div className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

/* ── Feature card ── */
const FEATURES = [
  { icon: Zap, title: 'Sub-second Updates', desc: 'All data refreshed every 60 seconds. Funding, OI, tickers, spreads, and arbitrage in a single API.' },
  { icon: Shield, title: 'Secure by Default', desc: 'Bearer token auth with SHA256 hashing, per-key rate limiting, and automatic usage tracking.' },
  { icon: Clock, title: 'Generous Free Tier', desc: '100 req/min and 5,000/day included. Enough for most bots, dashboards, and research workflows.' },
  { icon: Database, title: '33 CEX + DEX', desc: 'Binance, Bybit, OKX, Hyperliquid, dYdX, Drift, GMX, Kraken, Bitget, MEXC, and 23 more.' },
];

/* ── Endpoint groups ── */
const ENDPOINT_GROUPS = [
  {
    label: 'Market Data',
    color: 'blue' as const,
    endpoints: [
      { path: '/api/v1/funding', desc: 'Real-time funding rates across 33 exchanges', icon: Activity },
      { path: '/api/v1/funding/history', desc: 'Historical funding snapshots, up to 14 days', icon: History },
      { path: '/api/v1/openinterest', desc: 'Open interest data across exchanges in USD', icon: BarChart3 },
      { path: '/api/v1/tickers', desc: 'Live price, volume, and 24h change data', icon: TrendingUp },
      { path: '/api/v1/spreads', desc: 'Cross-exchange price spreads ranked by size', icon: Layers },
    ],
  },
  {
    label: 'Trading Intelligence',
    color: 'green' as const,
    endpoints: [
      { path: '/api/v1/arbitrage', desc: 'Funding arbitrage with grades and PnL projections', icon: GitCompare },
      { path: '/api/v1/longshort', desc: 'Long/short ratio data from Binance and OKX', icon: Scale },
      { path: '/api/v1/liquidations', desc: 'Recent liquidation events with USD values', icon: Flame },
      { path: '/api/v1/options', desc: 'Max pain, put/call ratio, IV across 4 exchanges', icon: LineChart },
    ],
  },
  {
    label: 'Market Context',
    color: 'purple' as const,
    endpoints: [
      { path: '/api/v1/top-movers', desc: 'Top gainers and losers by 24h change', icon: TrendingUp },
      { path: '/api/v1/global-stats', desc: 'BTC dominance, altcoin season, total market cap', icon: Globe },
      { path: '/api/v1/fear-greed', desc: 'Fear & Greed Index with optional 30d history', icon: Gauge },
    ],
  },
  {
    label: 'Reference',
    color: 'gray' as const,
    endpoints: [
      { path: '/api/v1/exchanges', desc: 'Exchange metadata, fees, and intervals', icon: Server },
      { path: '/api/v1/status', desc: 'API health check, no auth required', icon: AlertCircle },
    ],
  },
];

const COLOR_MAP = {
  blue: { badge: 'text-blue-400 bg-blue-500/10', line: 'from-blue-500/30', hover: 'hover:border-blue-500/15' },
  green: { badge: 'text-green-400 bg-green-500/10', line: 'from-green-500/30', hover: 'hover:border-green-500/15' },
  purple: { badge: 'text-purple-400 bg-purple-500/10', line: 'from-purple-500/30', hover: 'hover:border-purple-500/15' },
  gray: { badge: 'text-gray-400 bg-gray-500/10', line: 'from-gray-500/30', hover: 'hover:border-gray-500/15' },
};

/* ── Use case cards ── */
const USE_CASES = [
  { title: 'Funding Bots', desc: 'Scan 33 exchanges for rate discrepancies and execute delta-neutral arb strategies automatically.', color: 'border-l-amber-500/60' },
  { title: 'Trading Dashboards', desc: 'Build internal tools that show live OI, spreads, liquidations, and long/short ratios in one view.', color: 'border-l-blue-500/60' },
  { title: 'Quant Research', desc: 'Backtest funding strategies with 14 days of historical data. Correlate OI shifts with price action.', color: 'border-l-green-500/60' },
  { title: 'Alert Systems', desc: 'Monitor extreme funding, whale liquidations, or fear/greed shifts and push notifications to Telegram.', color: 'border-l-purple-500/60' },
];

export default function ApiDocsPage() {
  const [lang, setLang] = useState<Lang>('curl');

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[960px] mx-auto px-4 sm:px-6">

        {/* ── Hero ── */}
        <section className="relative py-16 sm:py-24 text-center overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 hero-mesh opacity-60 pointer-events-none" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgb(var(--hub-accent-rgb) / 0.07) 0%, transparent 65%)' }}
          />

          <div className="relative z-10">
            {/* Logo + badge */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Logo variant="icon" size="md" />
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                v1 Live
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              InfoHub{' '}
              <span className="text-gradient">Public API</span>
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-2">
              Programmatic access to funding rates, open interest, spreads, liquidations,
              and arbitrage opportunities across 33 exchanges.
            </p>
            <p className="text-neutral-600 text-xs sm:text-sm mb-8">
              Built for trading bots, dashboards, and quantitative research.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link
                href="/developers"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all hover:shadow-yellow-500/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Key size={15} />
                Get API Key
              </Link>
              <Link
                href="/developers/docs"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <BookOpen size={15} />
                Full Documentation
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 sm:gap-14">
              <Stat value="33" label="Exchanges" />
              <div className="w-px h-8 bg-white/[0.06]" />
              <Stat value="14" label="Endpoints" />
              <div className="w-px h-8 bg-white/[0.06]" />
              <Stat value="100/m" label="Free Tier" />
              <div className="hidden sm:block w-px h-8 bg-white/[0.06]" />
              <div className="hidden sm:block"><Stat value="<3s" label="Latency" /></div>
            </div>
          </div>
        </section>

        <div className="accent-line mb-14" />

        {/* ── Features ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 group hover:border-white/[0.12] hover:bg-white/[0.03] transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-hub-yellow/10 flex items-center justify-center mb-3 group-hover:bg-hub-yellow/15 transition-colors">
                <f.icon className="w-4.5 h-4.5 text-hub-yellow" size={18} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* ── Quick Start with Language Tabs ── */}
        <section className="mb-14">
          <h2 className="text-lg font-bold text-white mb-1">Quick Start</h2>
          <p className="text-neutral-500 text-sm mb-4">One request. All exchanges. Choose your language.</p>

          <div className="rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-0 border-b border-white/[0.06] bg-white/[0.02]">
              {(Object.keys(CODE_EXAMPLES) as Lang[]).map((key) => {
                const ex = CODE_EXAMPLES[key];
                return (
                  <button
                    key={key}
                    onClick={() => setLang(key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative ${
                      lang === key
                        ? 'text-amber-400'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <ex.icon className="w-3 h-3" />
                    {ex.label}
                    {lang === key && (
                      <span className="absolute bottom-0 left-2 right-2 h-px bg-amber-400" />
                    )}
                  </button>
                );
              })}
              <div className="ml-auto pr-2.5">
                <CopyBtn text={CODE_EXAMPLES[lang].code} />
              </div>
            </div>

            {/* Code */}
            <pre className="p-4 sm:p-5 text-xs sm:text-[13px] text-green-400/90 font-mono overflow-x-auto leading-relaxed min-h-[120px]">
              {CODE_EXAMPLES[lang].code}
            </pre>

            {/* Response preview */}
            <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 sm:px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-green-400 font-mono font-bold bg-green-500/10 px-1.5 py-0.5 rounded">200</span>
                <span className="text-[10px] text-neutral-600 font-mono">application/json</span>
                <span className="text-[10px] text-neutral-700 ml-auto font-mono">~47ms</span>
              </div>
              <pre className="text-xs text-neutral-400 font-mono overflow-x-auto leading-relaxed">
{`{ "success": true, "data": [{ "symbol": "BTC", "exchange": "Binance", "rate": 0.0100, "rate8h": 0.0100, ... }], "meta": { "exchanges": 24, "pairs": 6466 } }`}
              </pre>
            </div>
          </div>
        </section>

        {/* ── All 14 Endpoints ── */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">14 Endpoints</h2>
              <p className="text-neutral-500 text-sm">All GET, all JSON, all real-time. Click any endpoint for full docs.</p>
            </div>
            <Link href="/developers/docs" className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-400/80 hover:text-amber-400 transition-colors">
              Full reference <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-5">
            {ENDPOINT_GROUPS.map((group) => {
              const colors = COLOR_MAP[group.color];
              return (
                <div key={group.label}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${colors.badge}`}>
                      {group.label}
                    </span>
                    <div className={`flex-1 h-px bg-gradient-to-r ${colors.line} to-transparent`} />
                  </div>

                  <div className={`rounded-xl border border-white/[0.05] overflow-hidden divide-y divide-white/[0.03] ${colors.hover} transition-colors`}>
                    {group.endpoints.map((ep) => (
                      <Link
                        key={ep.path}
                        href={`/developers/docs#${ep.path.split('/').pop()}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-white/[0.01] hover:bg-white/[0.04] transition-all group/row"
                      >
                        <ep.icon className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0 group-hover/row:text-neutral-400 transition-colors" />
                        <span className="flex-shrink-0 text-[10px] font-bold tracking-wider text-green-400 bg-green-500/[0.08] px-2 py-0.5 rounded">
                          GET
                        </span>
                        <code className="text-xs text-neutral-300 font-mono truncate group-hover/row:text-white transition-colors">{ep.path}</code>
                        <span className="hidden sm:block ml-auto text-[11px] text-neutral-600 truncate max-w-[280px] group-hover/row:text-neutral-400 transition-colors">
                          {ep.desc}
                        </span>
                        <ArrowRight className="w-3 h-3 text-neutral-800 group-hover/row:text-neutral-400 group-hover/row:translate-x-0.5 transition-all flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── What People Build ── */}
        <section className="mb-14">
          <h2 className="text-lg font-bold text-white mb-1">What people build with it</h2>
          <p className="text-neutral-500 text-sm mb-5">From solo devs to trading firms.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {USE_CASES.map((uc) => (
              <div
                key={uc.title}
                className={`rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 border-l-2 ${uc.color} hover:bg-white/[0.03] transition-colors`}
              >
                <h3 className="text-sm font-semibold text-white mb-1.5">{uc.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Rate Limits ── */}
        <section className="mb-14">
          <h2 className="text-lg font-bold text-white mb-4">Rate Limits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="text-sm font-semibold text-white mb-3">Free Tier</div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Requests per minute</span>
                  <span className="text-white font-mono font-medium">100</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Requests per day</span>
                  <span className="text-white font-mono font-medium">5,000</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Endpoints</span>
                  <span className="text-white font-mono font-medium">All 14</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Price</span>
                  <span className="text-green-400 font-semibold">Free</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/10 bg-white/[0.02] p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-white">Pro Tier</span>
                <span className="text-[9px] text-amber-400/70 border border-amber-500/20 rounded-full px-1.5 py-0.5 uppercase font-bold tracking-wider">Soon</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Requests per minute</span>
                  <span className="text-white font-mono font-medium">500</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Requests per day</span>
                  <span className="text-amber-300 font-semibold">Unlimited</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Priority support</span>
                  <span className="text-white font-medium">Included</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>WebSocket feeds</span>
                  <span className="text-amber-300 font-semibold">Included</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mb-16">
          <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
            <div className="absolute inset-0 bg-gradient-to-br from-hub-yellow/[0.04] via-transparent to-hub-orange/[0.04]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/30 to-transparent" />

            <div className="relative p-6 sm:p-10 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Ready to build?</h3>
              <p className="text-neutral-500 text-sm mb-6 max-w-md mx-auto">
                Generate an API key and start pulling live data in under a minute. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/developers"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all hover:shadow-yellow-500/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Go to Developer Dashboard
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/developers/docs"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Read the Docs
                  <BookOpen size={15} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
