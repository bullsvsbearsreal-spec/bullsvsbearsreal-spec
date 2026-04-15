'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  ArrowRight, Zap, Shield, Clock, Database, Key, BookOpen,
  Activity, TrendingUp, BarChart3, Layers, GitCompare, Scale,
  Flame, LineChart, Globe, Gauge, History, Server, AlertCircle,
  Copy, Check, ChevronRight, Code2, Terminal, Play, ExternalLink,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Reusable components
   ═══════════════════════════════════════════════════ */

/* Scroll-triggered fade-in */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Animated counter */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        io.disconnect();
        const dur = 1200;
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(ease * target));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* Copy button */
function CopyBtn({ text, className = '' }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text.trim()); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className={`text-gray-600 hover:text-gray-300 transition-colors bg-black/50 backdrop-blur-sm border border-white/[0.06] rounded-md p-1.5 ${className}`}
      title="Copy"
    >
      {ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* JSON syntax highlighter for response preview */
function JsonHighlight({ json }: { json: string }) {
  const highlighted = json
    .replace(/"([^"]+)"(?=\s*:)/g, '<span class="text-purple-400">"$1"</span>')
    .replace(/:\s*"([^"]+)"/g, ': <span class="text-green-400">"$1"</span>')
    .replace(/:\s*([\d.]+)/g, ': <span class="text-amber-400">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="text-blue-400">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="text-gray-500">$1</span>');
  return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

/* ═══════════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════════ */

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

for row in r.json()["data"]:
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

const RESPONSE_JSON = `{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "rate": 0.0100,
      "rate8h": 0.0100,
      "predictedRate": 0.0085,
      "markPrice": 95000.50,
      "fundingInterval": "8h",
      "type": "cex"
    },
    {
      "symbol": "ETH",
      "exchange": "Bybit",
      "rate": 0.0065,
      "rate8h": 0.0065,
      "markPrice": 3480.20,
      "fundingInterval": "8h",
      "type": "cex"
    }
  ],
  "meta": { "exchanges": 24, "pairs": 6466 }
}`;

const FEATURES = [
  { icon: Zap, title: 'Real-time Data', desc: 'All data refreshed every 60 seconds. Funding, OI, tickers, spreads, and arbitrage from a single API.', gradient: 'from-amber-500/20 to-orange-500/20' },
  { icon: Shield, title: 'Secure by Default', desc: 'Bearer token auth with SHA256 hashing, per-key rate limits, and automatic usage tracking.', gradient: 'from-blue-500/20 to-cyan-500/20' },
  { icon: Clock, title: 'Generous Free Tier', desc: '100 req/min and 5,000/day. Enough for most bots, dashboards, and research workflows.', gradient: 'from-green-500/20 to-emerald-500/20' },
  { icon: Database, title: '33 CEX + DEX', desc: 'Binance, Bybit, OKX, Hyperliquid, dYdX, Drift, GMX, Kraken, Bitget, MEXC, and 23 more.', gradient: 'from-purple-500/20 to-pink-500/20' },
];

const ENDPOINT_GROUPS = [
  {
    label: 'Market Data', color: 'blue' as const,
    endpoints: [
      { path: '/api/v1/funding', desc: 'Real-time funding rates across 33 exchanges', icon: Activity },
      { path: '/api/v1/funding/history', desc: 'Historical funding snapshots, up to 14 days', icon: History },
      { path: '/api/v1/openinterest', desc: 'Open interest data across exchanges in USD', icon: BarChart3 },
      { path: '/api/v1/tickers', desc: 'Live price, volume, and 24h change data', icon: TrendingUp },
      { path: '/api/v1/spreads', desc: 'Cross-exchange price spreads ranked by size', icon: Layers },
    ],
  },
  {
    label: 'Trading Intelligence', color: 'green' as const,
    endpoints: [
      { path: '/api/v1/arbitrage', desc: 'Funding arbitrage with grades and PnL projections', icon: GitCompare },
      { path: '/api/v1/longshort', desc: 'Long/short ratio data from Binance and OKX', icon: Scale },
      { path: '/api/v1/liquidations', desc: 'Recent liquidation events with USD values', icon: Flame },
      { path: '/api/v1/options', desc: 'Max pain, put/call ratio, IV across 4 exchanges', icon: LineChart },
    ],
  },
  {
    label: 'Market Context', color: 'purple' as const,
    endpoints: [
      { path: '/api/v1/top-movers', desc: 'Top gainers and losers by 24h change', icon: TrendingUp },
      { path: '/api/v1/global-stats', desc: 'BTC dominance, altcoin season, total market cap', icon: Globe },
      { path: '/api/v1/fear-greed', desc: 'Fear & Greed Index with optional 30d history', icon: Gauge },
    ],
  },
  {
    label: 'Reference', color: 'gray' as const,
    endpoints: [
      { path: '/api/v1/exchanges', desc: 'Exchange metadata, fees, and intervals', icon: Server },
      { path: '/api/v1/status', desc: 'API health check, no auth required', icon: AlertCircle },
    ],
  },
];

const COLOR_MAP = {
  blue:   { badge: 'text-blue-400 bg-blue-500/10',     line: 'from-blue-500/30',   hover: 'hover:border-blue-500/20',   glow: 'group-hover/grp:shadow-blue-500/5' },
  green:  { badge: 'text-green-400 bg-green-500/10',    line: 'from-green-500/30',  hover: 'hover:border-green-500/20',  glow: 'group-hover/grp:shadow-green-500/5' },
  purple: { badge: 'text-purple-400 bg-purple-500/10',  line: 'from-purple-500/30', hover: 'hover:border-purple-500/20', glow: 'group-hover/grp:shadow-purple-500/5' },
  gray:   { badge: 'text-gray-400 bg-gray-500/10',      line: 'from-gray-500/30',   hover: 'hover:border-gray-500/20',   glow: 'group-hover/grp:shadow-gray-500/5' },
};

const USE_CASES = [
  { title: 'Funding Rate Bots', desc: 'Scan 33 exchanges for rate discrepancies and execute delta-neutral arb strategies automatically.', color: 'border-l-amber-500/60', icon: '⚡' },
  { title: 'Trading Dashboards', desc: 'Build internal tools showing live OI, spreads, liquidations, and long/short ratios in one view.', color: 'border-l-blue-500/60', icon: '📊' },
  { title: 'Quant Research', desc: 'Backtest funding strategies with 14 days of historical data. Correlate OI shifts with price action.', color: 'border-l-green-500/60', icon: '🔬' },
  { title: 'Alert Systems', desc: 'Monitor extreme funding, whale liquidations, or fear/greed shifts. Push to Telegram, Discord, or email.', color: 'border-l-purple-500/60', icon: '🔔' },
];

const EXCHANGES = [
  'Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC', 'Kraken', 'BingX', 'Phemex',
  'Bitunix', 'KuCoin', 'HTX', 'Bitfinex', 'WhiteBIT', 'Coinbase', 'CoinEx', 'Gate.io',
  'Hyperliquid', 'dYdX', 'Drift', 'GMX',
];

const STEPS = [
  { num: '1', title: 'Create an account', desc: 'Sign up free at info-hub.io. No credit card needed.', icon: Key },
  { num: '2', title: 'Generate an API key', desc: 'Head to the developer dashboard and create your first key.', icon: Code2 },
  { num: '3', title: 'Start pulling data', desc: 'Make your first request. All 14 endpoints are ready.', icon: Play },
];

/* ═══════════════════════════════════════════════════
   Live status indicator
   ═══════════════════════════════════════════════════ */
function LiveStatus() {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [latency, setLatency] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    fetch('/api/v1/status', { signal: AbortSignal.timeout(5000) })
      .then(r => { if (r.ok) { setStatus('online'); setLatency(Date.now() - t0); } else setStatus('offline'); })
      .catch(() => setStatus('offline'));
  }, []);
  return (
    <div className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs transition-all duration-700 ${
      status === 'online'
        ? 'bg-emerald-500/[0.06] border border-emerald-500/15'
        : status === 'offline'
        ? 'bg-red-500/[0.06] border border-red-500/15'
        : 'bg-white/[0.03] border border-white/[0.06]'
    }`}>
      <span className="relative flex h-2 w-2">
        {status === 'online' && (
          <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
        )}
        {status === 'loading' && (
          <span className="animate-breathe-fast absolute inline-flex h-full w-full rounded-full bg-gray-400" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${
          status === 'online'
            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'
            : status === 'offline'
            ? 'bg-red-400'
            : 'bg-neutral-500'
        }`} />
      </span>
      <span className={`font-medium ${
        status === 'online' ? 'text-emerald-300/90' : status === 'offline' ? 'text-red-300/80' : 'text-neutral-400'
      }`}>
        {status === 'online' ? 'Everything looks good' : status === 'offline' ? 'Trouble reaching the API' : 'Checking...'}
      </span>
      {status === 'online' && latency > 0 && (
        <span className="text-emerald-400/30 font-mono text-[10px]">{latency}ms</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════ */

export default function ApiDocsPage() {
  const [lang, setLang] = useState<Lang>('curl');
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[980px] mx-auto px-4 sm:px-6">

        {/* ═══ Hero ═══ */}
        <section className="relative py-16 sm:py-24 text-center overflow-hidden">
          {/* Layered backgrounds */}
          <div className="absolute inset-0 hero-mesh opacity-50 pointer-events-none" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgb(var(--hub-accent-rgb) / 0.08) 0%, transparent 60%)' }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          <div className="relative z-10">
            {/* Logo + live status */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Logo variant="icon" size="lg" />
              <LiveStatus />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-5">
              InfoHub{' '}
              <span className="text-gradient">Public API</span>
            </h1>

            <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-2">
              Real-time derivatives data from 33 exchanges, delivered through 14 REST endpoints.
            </p>
            <p className="text-neutral-600 text-sm mb-10">
              Built for trading bots, dashboards, and quantitative research.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
              <Link
                href="/developers"
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all hover:shadow-yellow-500/40 hover:scale-[1.03] active:scale-[0.98]"
              >
                <Key size={16} />
                Get Free API Key
              </Link>
              <Link
                href="/developers/docs"
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                <BookOpen size={16} />
                Full Documentation
              </Link>
            </div>

            {/* Animated stats */}
            <div className="inline-flex items-center gap-6 sm:gap-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-8 py-5">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono"><AnimatedNumber target={33} /></div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Exchanges</div>
              </div>
              <div className="w-px h-10 bg-white/[0.06]" />
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono"><AnimatedNumber target={14} /></div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Endpoints</div>
              </div>
              <div className="w-px h-10 bg-white/[0.06]" />
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono"><AnimatedNumber target={100} suffix="/m" /></div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Free Tier</div>
              </div>
              <div className="hidden sm:block w-px h-10 bg-white/[0.06]" />
              <div className="hidden sm:block text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-400 font-mono">&lt;<AnimatedNumber target={3} />s</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Latency</div>
              </div>
            </div>
          </div>
        </section>

        {/* Exchange ticker */}
        <div className="mb-14 overflow-hidden mask-fade">
          <div className="flex items-center gap-4 animate-scroll-x">
            {[...EXCHANGES, ...EXCHANGES].map((name, i) => (
              <span key={`${name}-${i}`} className="text-[11px] text-neutral-600 font-medium whitespace-nowrap uppercase tracking-wider flex-shrink-0">
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* ═══ Features ═══ */}
        <FadeIn className="mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 group hover:border-white/[0.14] transition-all overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3 group-hover:border-white/[0.12] transition-colors">
                    <f.icon className="w-5 h-5 text-hub-yellow" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed group-hover:text-neutral-400 transition-colors">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* ═══ Interactive Quick Start ═══ */}
        <FadeIn className="mb-16">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">Quick Start</h2>
            <span className="text-neutral-600 text-xs">Choose your language</span>
          </div>
          <p className="text-neutral-500 text-sm mb-5">One request. All exchanges. Response in milliseconds.</p>

          <div className="rounded-2xl border border-white/[0.08] bg-[#060606] overflow-hidden shadow-2xl shadow-black/40">
            {/* Tab bar */}
            <div className="flex items-center border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-1.5 px-4 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <div className="flex items-center gap-0 ml-2">
                {(Object.keys(CODE_EXAMPLES) as Lang[]).map((key) => {
                  const ex = CODE_EXAMPLES[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setLang(key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative ${
                        lang === key
                          ? 'text-amber-400 bg-white/[0.03]'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      <ex.icon className="w-3 h-3" />
                      {ex.label}
                      {lang === key && (
                        <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-amber-400 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto pr-3 flex items-center gap-2">
                <CopyBtn text={CODE_EXAMPLES[lang].code} />
              </div>
            </div>

            {/* Request code */}
            <div className="relative">
              <div className="absolute top-3 left-4 text-[9px] text-neutral-700 uppercase tracking-wider font-medium">Request</div>
              <pre className="p-4 pt-8 sm:p-5 sm:pt-9 text-xs sm:text-[13px] text-green-400/90 font-mono overflow-x-auto leading-relaxed">
                {CODE_EXAMPLES[lang].code}
              </pre>
            </div>

            {/* Response section */}
            <div className="border-t border-white/[0.05]">
              <button
                onClick={() => setShowResponse(!showResponse)}
                className="w-full flex items-center gap-2 px-4 sm:px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] text-green-400 font-medium bg-green-500/[0.08] border border-green-500/10 px-2 py-0.5 rounded-md">
                  <span className="w-1 h-1 rounded-full bg-green-400" />
                  Success
                </span>
                <span className="text-[10px] text-neutral-600">JSON</span>
                <span className="text-[10px] text-neutral-700 ml-1">responded in ~47ms</span>
                <ChevronRight className={`w-3 h-3 text-neutral-600 ml-auto transition-transform duration-200 ${showResponse ? 'rotate-90' : ''}`} />
                <span className="text-[10px] text-neutral-600">{showResponse ? 'Hide' : 'Show'} response</span>
              </button>
              {showResponse && (
                <div className="relative border-t border-white/[0.04]">
                  <div className="absolute top-2.5 right-3 z-10">
                    <CopyBtn text={RESPONSE_JSON} />
                  </div>
                  <pre className="p-4 sm:p-5 text-xs text-neutral-400 font-mono overflow-x-auto leading-relaxed max-h-[400px] overflow-y-auto">
                    <JsonHighlight json={RESPONSE_JSON} />
                  </pre>
                </div>
              )}
            </div>
          </div>
        </FadeIn>

        {/* ═══ All 14 Endpoints ═══ */}
        <FadeIn className="mb-16">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">14 Endpoints</h2>
            <Link href="/developers/docs" className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-400/80 hover:text-amber-400 transition-colors font-medium">
              Full reference <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-neutral-500 text-sm mb-6">All GET, all JSON, all real-time. Click any endpoint for full docs.</p>

          <div className="space-y-5">
            {ENDPOINT_GROUPS.map((group) => {
              const colors = COLOR_MAP[group.color];
              return (
                <div key={group.label} className="group/grp">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${colors.badge}`}>
                      {group.label}
                    </span>
                    <div className={`flex-1 h-px bg-gradient-to-r ${colors.line} to-transparent`} />
                    <span className="text-[10px] text-neutral-700 font-mono">{group.endpoints.length}</span>
                  </div>

                  <div className={`rounded-xl border border-white/[0.05] overflow-hidden divide-y divide-white/[0.03] transition-all ${colors.hover} ${colors.glow} shadow-lg shadow-transparent`}>
                    {group.endpoints.map((ep) => (
                      <Link
                        key={ep.path}
                        href={`/developers/docs#${ep.path.split('/').pop()}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3.5 bg-white/[0.01] hover:bg-white/[0.04] transition-all group/row"
                      >
                        <ep.icon className="w-4 h-4 text-neutral-700 flex-shrink-0 group-hover/row:text-neutral-400 transition-colors" />
                        <span className="flex-shrink-0 text-[10px] font-bold tracking-wider text-green-400 bg-green-500/[0.08] px-2 py-0.5 rounded">
                          GET
                        </span>
                        <code className="text-[13px] text-neutral-300 font-mono truncate group-hover/row:text-white transition-colors">{ep.path}</code>
                        <span className="hidden sm:block ml-auto text-[11px] text-neutral-600 truncate max-w-[280px] group-hover/row:text-neutral-400 transition-colors">
                          {ep.desc}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-800 group-hover/row:text-amber-400 group-hover/row:translate-x-0.5 transition-all flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Link href="/developers/docs" className="sm:hidden flex items-center justify-center gap-1.5 mt-4 text-sm text-amber-400/80 hover:text-amber-400 transition-colors font-medium">
            View full reference <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </FadeIn>

        {/* ═══ How It Works ═══ */}
        <FadeIn className="mb-16">
          <h2 className="text-xl font-bold text-white mb-2">Three steps to live data</h2>
          <p className="text-neutral-500 text-sm mb-6">From signup to first response in under a minute.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden sm:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20" />

            {STEPS.map((step, i) => (
              <div key={step.num} className="relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 text-center hover:border-white/[0.12] transition-all group">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-500/15 group-hover:border-amber-500/30 transition-colors">
                  <span className="text-amber-400 font-bold text-sm">{step.num}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{step.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* ═══ What People Build ═══ */}
        <FadeIn className="mb-16">
          <h2 className="text-xl font-bold text-white mb-2">What people build with it</h2>
          <p className="text-neutral-500 text-sm mb-5">From solo devs running bots to firms building internal tools.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {USE_CASES.map((uc) => (
              <div
                key={uc.title}
                className={`rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 border-l-2 ${uc.color} hover:bg-white/[0.03] hover:border-white/[0.1] transition-all group`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{uc.icon}</span>
                  <h3 className="text-sm font-semibold text-white">{uc.title}</h3>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed group-hover:text-neutral-400 transition-colors">{uc.desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* ═══ Rate Limits ═══ */}
        <FadeIn className="mb-16">
          <h2 className="text-xl font-bold text-white mb-5">Pricing</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 relative">
              <div className="text-lg font-bold text-white mb-1">Free</div>
              <div className="text-3xl font-bold text-white font-mono mb-4">$0 <span className="text-sm font-normal text-neutral-500">/ forever</span></div>
              <div className="space-y-3 text-sm mb-6">
                {[
                  '100 requests per minute',
                  '5,000 requests per day',
                  'All 14 endpoints',
                  'Community support',
                ].map((text) => (
                  <div key={text} className="flex items-center gap-2.5 text-neutral-400">
                    <Check className="w-4 h-4 text-green-400/70 flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/developers"
                className="block text-center py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] text-white text-sm font-medium transition-all"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-amber-500/15 bg-white/[0.02] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">Pro</span>
                  <span className="text-[9px] text-amber-400/80 border border-amber-500/20 bg-amber-500/[0.06] rounded-full px-2 py-0.5 uppercase font-bold tracking-wider">Coming Soon</span>
                </div>
                <div className="text-3xl font-bold text-white font-mono mb-4">$29 <span className="text-sm font-normal text-neutral-500">/ month</span></div>
                <div className="space-y-3 text-sm mb-6">
                  {[
                    '500 requests per minute',
                    'Unlimited daily requests',
                    'WebSocket real-time feeds',
                    'Priority support + SLA',
                  ].map((text) => (
                    <div key={text} className="flex items-center gap-2.5 text-neutral-400">
                      <Check className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
                <button
                  disabled
                  className="block w-full text-center py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/20 text-amber-400/60 text-sm font-medium cursor-not-allowed"
                >
                  Join Waitlist
                </button>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* ═══ CTA ═══ */}
        <FadeIn className="mb-16">
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08]">
            <div className="absolute inset-0 bg-gradient-to-br from-hub-yellow/[0.05] via-transparent to-hub-orange/[0.05]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/10 to-transparent" />

            <div className="relative p-8 sm:p-12 text-center">
              <Logo variant="icon" size="md" className="mx-auto mb-4 opacity-60" />
              <h3 className="text-2xl font-bold text-white mb-3">Ready to build?</h3>
              <p className="text-neutral-400 text-sm mb-7 max-w-md mx-auto">
                Generate an API key and start pulling live data in under a minute. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/developers"
                  className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 transition-all hover:shadow-yellow-500/40 hover:scale-[1.03] active:scale-[0.98]"
                >
                  Go to Developer Dashboard
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/developers/docs"
                  className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium text-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
                >
                  Read the Docs
                  <BookOpen size={16} />
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>

      </main>

      <Footer />
    </div>
  );
}
