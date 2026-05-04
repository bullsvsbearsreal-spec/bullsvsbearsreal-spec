'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Logo from '@/components/Logo';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AuthPromptBanner from '@/components/AuthPromptBanner';
import {
  Key, Copy, Check, Trash2, Zap, BarChart3, TrendingUp, Shield, Clock, Globe,
  ArrowRight, Terminal, Code2, Activity, Layers, LineChart,
  ChevronRight, Database, Wifi, ChevronDown, Hash,
} from 'lucide-react';

interface ApiKeyInfo {
  id: string;
  prefix: string;
  name: string;
  tier: string;
  lastUsedAt: string | null;
  requestsToday: number;
  createdAt: string;
}

/* Syntax-highlighted JSON line renderer */
function JsonLine({ text }: { text: string }) {
  // Colorize JSON: keys = purple, strings = green, numbers = amber, booleans = blue, brackets = gray
  const parts: { text: string; color: string }[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Match JSON key: "key":
    const keyMatch = remaining.match(/^(\s*")([\w]+)(":\s*)/);
    if (keyMatch) {
      parts.push({ text: keyMatch[1], color: 'text-gray-500' });
      parts.push({ text: keyMatch[2], color: 'text-purple-300' });
      parts.push({ text: keyMatch[3], color: 'text-gray-500' });
      remaining = remaining.slice(keyMatch[0].length);
      continue;
    }
    // Match string value: "..."
    const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/);
    if (strMatch) {
      parts.push({ text: strMatch[1], color: 'text-green-300' });
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }
    // Match number
    const numMatch = remaining.match(/^(-?\d+\.?\d*)/);
    if (numMatch) {
      parts.push({ text: numMatch[1], color: 'text-amber-300' });
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }
    // Match boolean
    const boolMatch = remaining.match(/^(true|false|null)/);
    if (boolMatch) {
      parts.push({ text: boolMatch[1], color: 'text-blue-300' });
      remaining = remaining.slice(boolMatch[0].length);
      continue;
    }
    // Everything else (brackets, commas, whitespace)
    parts.push({ text: remaining[0], color: 'text-gray-500' });
    remaining = remaining.slice(1);
  }

  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={p.color}>{p.text}</span>
      ))}
    </>
  );
}

/* Typing animation for the hero terminal */
const TERMINAL_LINES = [
  { type: 'cmd' as const, text: 'curl -s -H "Authorization: Bearer ih_k7x..." \\' },
  { type: 'cmd' as const, text: '  "https://info-hub.io/api/v1/arbitrage?grade=A"' },
  { type: 'blank' as const, text: '' },
  { type: 'json' as const, text: '{' },
  { type: 'json' as const, text: '  "success": true,' },
  { type: 'json' as const, text: '  "data": [{' },
  { type: 'json' as const, text: '    "symbol": "ETH",' },
  { type: 'json' as const, text: '    "long": { "exchange": "Bybit", "rate": -0.0032 },' },
  { type: 'json' as const, text: '    "short": { "exchange": "dYdX", "rate": 0.0187 },' },
  { type: 'json' as const, text: '    "spread": 0.0219,' },
  { type: 'json' as const, text: '    "annualized": "19.18%",' },
  { type: 'json' as const, text: '    "grade": "A"' },
  { type: 'json' as const, text: '  }]' },
  { type: 'json' as const, text: '}' },
];

/* Fade-in on scroll wrapper */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => setVisible(true), delay);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
}

/* Tiny copy button for code blocks */
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="absolute top-2.5 right-2.5 text-gray-600 hover:text-gray-300 transition-colors bg-black/60 backdrop-blur-sm border border-white/[0.06] rounded-md p-1.5"
      title="Copy"
    >
      {ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* FAQ accordion item */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm font-medium text-white pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-[13px] text-gray-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

const EXCHANGE_NAMES = [
  'Binance', 'Bybit', 'OKX', 'Bitget', 'MEXC', 'Kraken', 'BingX', 'KuCoin',
  'Hyperliquid', 'dYdX', 'GMX', 'Phemex', 'Bitunix', 'HTX', 'Coinbase',
  'Deribit', 'Aevo', 'Bitfinex', 'Gate.io',
];

function HeroTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    // Typing effect: reveal lines progressively
    if (visibleLines < TERMINAL_LINES.length) {
      const delay = visibleLines < 2 ? 600 : visibleLines === 2 ? 300 : 80;
      const t = setTimeout(() => setVisibleLines(v => v + 1), delay);
      return () => clearTimeout(t);
    }
  }, [visibleLines]);

  useEffect(() => {
    const t = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative group">
      {/* Ambient glow behind terminal */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 blur-md" />
      <div className="absolute -inset-4 rounded-3xl bg-amber-500/[0.03] blur-2xl" />
      <div className="relative bg-[#0a0a0a] border border-white/[0.08] group-hover:border-amber-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 transition-colors duration-500">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[11px] text-gray-500 font-mono ml-2">info-hub.io</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
            </span>
            <span className="text-[10px] text-emerald-400/50 font-mono">connected</span>
          </div>
        </div>
        {/* Terminal body */}
        <div className="p-4 sm:p-5 font-mono text-[11px] sm:text-xs leading-relaxed min-h-[280px] sm:min-h-[320px]">
          {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i}>
              {line.type === 'cmd' && i === 0 && (
                <span className="text-green-400 select-none">$ </span>
              )}
              {line.type === 'cmd' && i === 1 && (
                <span className="text-transparent select-none">{'  '}</span>
              )}
              {line.type === 'cmd' && <span className="text-gray-300">{line.text}</span>}
              {line.type === 'json' && <JsonLine text={line.text} />}
            </div>
          ))}
          {visibleLines < TERMINAL_LINES.length && (
            <span className={`inline-block w-2 h-4 bg-amber-400/80 ${cursorVisible ? 'opacity-100' : 'opacity-0'}`} />
          )}
          {visibleLines >= TERMINAL_LINES.length && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] text-green-400/70 bg-green-500/[0.06] border border-green-500/10 px-2 py-0.5 rounded-md">
                  <span className="w-1 h-1 rounded-full bg-green-400/70" />
                  success
                </span>
                <span className="text-[10px] text-gray-600">responded in 47ms</span>
              </div>
              <div className="mt-2 text-green-400/50">
                <span className="text-green-400 select-none">$ </span>
                <span className={`inline-block w-2 h-4 bg-green-400/80 -mb-0.5 ${cursorVisible ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Animated counter */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1200;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{value}{suffix}</span>;
}

const ENDPOINT_GROUPS = [
  {
    label: 'Market Data',
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/10',
    endpoints: [
      ['GET', '/api/v1/funding', 'Real-time funding rates across 33 exchanges'],
      ['GET', '/api/v1/openinterest', 'Open interest data across exchanges'],
      ['GET', '/api/v1/tickers', 'Price & volume across all exchanges'],
      ['GET', '/api/v1/spreads', 'Cross-exchange price spreads'],
    ],
  },
  {
    label: 'Trading Intelligence',
    icon: TrendingUp,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/10',
    endpoints: [
      ['GET', '/api/v1/arbitrage', 'Funding arbitrage with feasibility grades'],
      ['GET', '/api/v1/longshort', 'Long/short ratios (Binance, OKX)'],
      ['GET', '/api/v1/liquidations', 'Recent liquidation feed'],
      ['GET', '/api/v1/options', 'Options: max pain, P/C ratio, IV'],
    ],
  },
  {
    label: 'Market Context',
    icon: Globe,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/10',
    endpoints: [
      ['GET', '/api/v1/top-movers', 'Top gainers & losers by 24h change'],
      ['GET', '/api/v1/global-stats', 'Altcoin season, BTC dominance, market cap'],
      ['GET', '/api/v1/fear-greed', 'Fear & Greed Index + 30d history'],
      ['GET', '/api/v1/funding/history', 'Historical funding snapshots (7d)'],
    ],
  },
  {
    label: 'Reference',
    icon: Layers,
    color: 'text-neutral-400',
    bg: 'bg-neutral-500/10',
    border: 'border-neutral-500/10',
    endpoints: [
      ['GET', '/api/v1/exchanges', 'Exchange metadata, fees & intervals'],
      ['GET', '/api/v1/status', 'API health status (no auth required)'],
    ],
  },
];

const STATS = [
  { value: 33, suffix: '', label: 'Exchanges', icon: Database },
  { value: 14, suffix: '', label: 'Endpoints', icon: Wifi },
  { value: 100, suffix: '/m', label: 'Free Requests', icon: Zap },
  { value: 3, suffix: 's', label: 'Data Freshness', icon: Clock },
];

export default function DevelopersPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/keys');
      const json = await res.json();
      if (json.success) setKeys(json.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.user) fetchKeys();
  }, [session, fetchKeys]);

  const createKey = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName || 'Default' }),
      });
      const json = await res.json();
      if (json.success) {
        setNewKey(json.data.key);
        setKeyName('');
        fetchKeys();
      } else {
        setError(json.error || 'Failed to create key');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await fetch(`/api/v1/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch {}
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-20 text-center text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main id="main-content">

        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,184,0,0.12),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,rgba(255,140,0,0.06),transparent)]" />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* Left copy */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Logo size="xl" animated />
                  <div className="h-7 w-px bg-white/10" />
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300/90 text-[11px] font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                    </span>
                    Serving live data
                  </div>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] mb-5">
                  <span className="text-white">One API for</span>
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500">every crypto exchange</span>
                </h1>

                <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-4 max-w-lg">
                  Funding rates, open interest, liquidations, spreads, options, and arbitrage aggregated from 33 exchanges into a single REST API.
                </p>
                <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-lg">
                  Built by traders, for traders. Whether you're running a funding bot, building a dashboard, or doing research, get live data in one call instead of managing 33 API keys.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-10">
                  {session?.user ? (
                    <button
                      onClick={() => document.getElementById('api-keys')?.scrollIntoView({ behavior: 'smooth' })}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Key className="w-4 h-4" /> Manage API Keys
                    </button>
                  ) : (
                    <Link
                      href="/login?callbackUrl=/developers"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Key className="w-4 h-4" /> Get Free API Key
                    </Link>
                  )}
                  <Link
                    href="/developers/docs"
                    className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 hover:text-white font-medium px-6 py-3.5 rounded-xl text-sm transition-all"
                  >
                    <Code2 className="w-4 h-4" /> Documentation <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3">
                  {STATS.map(s => (
                    <div key={s.label} className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <s.icon className="w-3.5 h-3.5 text-amber-400/60" />
                        <span className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                          <AnimatedNumber target={s.value} suffix={s.suffix} />
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right terminal */}
              <div className="hidden lg:block">
                <HeroTerminal />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile terminal (below fold) */}
        <div className="lg:hidden max-w-xl mx-auto px-4 -mt-4 mb-12">
          <HeroTerminal />
        </div>

        {/* Exchange trust ticker */}
        <div className="border-y border-white/[0.04] bg-white/[0.01] py-4 mb-14 sm:mb-20 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-gray-600 uppercase tracking-widest font-medium shrink-0">Data from</span>
              <div className="flex items-center gap-3 overflow-hidden mask-fade">
                <div className="flex items-center gap-3 animate-scroll-x">
                  {[...EXCHANGE_NAMES, ...EXCHANGE_NAMES].map((name, i) => (
                    <span key={i} className="text-xs text-gray-500 font-medium whitespace-nowrap bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.04]">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* How it works */}
        <FadeIn className="mb-14 sm:mb-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">Three steps to live data</h2>
            <p className="text-gray-500 text-sm">From signup to first API call in under a minute</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden sm:block absolute top-10 left-[16.6%] right-[16.6%] h-px bg-gradient-to-r from-amber-500/20 via-amber-500/30 to-amber-500/20" />
            {([
              { step: 1, title: 'Create an account', desc: 'Sign up free. No credit card, no approval process. Takes 30 seconds.', icon: Key },
              { step: 2, title: 'Generate an API key', desc: 'One click in the dashboard. Your key starts with ih_ and works instantly.', icon: Hash },
              { step: 3, title: 'Make your first call', desc: 'Pass the key as a Bearer token. Get structured JSON back in ~50ms.', icon: Zap },
            ] as const).map(s => (
              <div key={s.step} className="relative text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 mb-4 relative z-10">
                  <s.icon className="w-6 h-6 text-amber-400" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">{s.step}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{s.title}</h3>
                <p className="text-gray-500 text-[13px] leading-relaxed max-w-[240px] mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Use Cases */}
        <FadeIn className="mb-14 sm:mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">What people build with it</h2>
            <p className="text-gray-500 text-sm">From side projects to production trading systems</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              {
                title: 'Funding rate bots',
                accent: 'border-l-amber-500',
                icon: Activity,
                desc: 'Automatically long on cheap exchanges, short on expensive ones. The /arbitrage endpoint does the math for you. Just filter by grade and execute.',
              },
              {
                title: 'Custom dashboards',
                accent: 'border-l-blue-500',
                icon: BarChart3,
                desc: 'Build Grafana panels, Discord bots, or Telegram alerts using real-time OI, liquidation, and spread data from a single endpoint.',
              },
              {
                title: 'Quant research',
                accent: 'border-l-purple-500',
                icon: LineChart,
                desc: 'Backtest strategies using historical funding snapshots, track cross-exchange spread patterns, and monitor market sentiment shifts.',
              },
            ] as const).map(c => (
              <div key={c.title} className={`bg-white/[0.02] border border-white/[0.06] border-l-2 ${c.accent} rounded-xl p-5 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all`}>
                <c.icon className="w-5 h-5 text-gray-500 mb-3" />
                <h3 className="text-sm font-bold text-white mb-2">{c.title}</h3>
                <p className="text-gray-500 text-[13px] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Auth prompt (not signed in) */}
        {!session?.user && (
          <AuthPromptBanner variant="api-key" dismissible={false} className="mb-10" />
        )}

        {/* API Key Management (signed in) */}
        {session?.user && (
          <div id="api-keys" className="mb-14 sm:mb-20 scroll-mt-20">
            {/* New key banner */}
            {newKey && (
              <div className="bg-green-950/40 border border-green-800/50 rounded-xl p-5 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-green-400 font-semibold text-sm">API Key Created. Copy it now</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/60 text-green-300 px-4 py-2.5 rounded-lg font-mono text-sm break-all border border-green-900/50">
                    {newKey}
                  </code>
                  <button
                    onClick={copyKey}
                    className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium shrink-0 transition-colors"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <p className="text-green-600 text-xs mt-2.5">This key will not be shown again. Store it securely.</p>
                <button onClick={() => setNewKey(null)} className="text-green-700 text-xs mt-1 hover:text-green-500 transition-colors">
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Create key */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" /> Create API Key
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Key name (optional)"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:border-amber-500/50 focus:outline-none transition-colors"
                    maxLength={50}
                  />
                  <button
                    onClick={createKey}
                    disabled={loading}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
                  >
                    {loading ? 'Creating...' : 'Generate'}
                  </button>
                </div>
                {error && <p role="alert" className="text-red-400 text-xs mt-2">{error}</p>}
              </div>

              {/* Existing keys */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-base font-semibold mb-3">Your Keys ({keys.length}/5)</h2>
                {keys.length === 0 ? (
                  <p className="text-gray-600 text-sm">No API keys yet.</p>
                ) : (
                  <div className="space-y-2">
                    {keys.map(k => (
                      <div key={k.id} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-amber-400 font-mono text-xs">{k.prefix}...</code>
                            <span className="text-gray-500 text-xs truncate">{k.name}</span>
                            <span className="bg-amber-500/15 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {k.tier}
                            </span>
                          </div>
                          <div className="text-gray-600 text-[10px] mt-0.5">
                            {k.requestsToday} today
                            {k.lastUsedAt && ` · Last ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                          </div>
                        </div>
                        <button
                          onClick={() => revokeKey(k.id)}
                          className="text-red-500/60 hover:text-red-400 transition-colors p-1"
                          title="Revoke key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Endpoints by Category */}
        <FadeIn className="mb-14 sm:mb-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">API Endpoints</h2>
              <p className="text-gray-500 text-sm mt-1">14 endpoints across 4 categories</p>
            </div>
            <Link href="/developers/docs" className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1 transition-colors font-medium">
              Full docs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ENDPOINT_GROUPS.map(g => (
              <div key={g.label} className={`bg-white/[0.02] border ${g.border} hover:border-white/[0.1] rounded-xl p-5 transition-colors group`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-1.5 rounded-lg ${g.bg}`}>
                    <g.icon className={`w-4 h-4 ${g.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{g.label}</h3>
                  <span className="text-[10px] text-gray-600 ml-auto bg-white/[0.04] px-2 py-0.5 rounded-full">{g.endpoints.length}</span>
                </div>
                <div className="space-y-2">
                  {g.endpoints.map(([method, path, desc]) => (
                    <Link key={path as string} href={`/developers/docs#${(path as string).split('/').pop()}`} className="flex items-start gap-2.5 py-1 -mx-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group/ep">
                      <span className="text-[10px] text-green-400 font-mono mt-1 shrink-0 w-7 font-bold">{method}</span>
                      <div className="min-w-0 flex-1">
                        <code className="text-xs text-amber-400/90 font-mono font-medium">{(path as string).replace('/api/v1/', '/')}</code>
                        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{desc}</p>
                      </div>
                      <ArrowRight className="w-3 h-3 text-gray-700 group-hover/ep:text-amber-400/60 mt-1 shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Quick Start */}
        <FadeIn className="mb-14 sm:mb-20" delay={100}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Quick Start</h2>
            <p className="text-gray-500 text-sm mt-1">Get data in under 30 seconds</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {([
              {
                icon: Terminal, iconColor: 'text-green-400', label: 'curl', labelExtra: 'Simplest',
                code: `curl -s -H "Authorization: Bearer ih_..." \\
  "https://info-hub.io/api/v1/\\
arbitrage?grade=A,B" | jq .`,
              },
              {
                icon: Code2, iconColor: 'text-blue-400', label: 'Python', labelExtra: 'Most popular',
                code: `import requests

h = {"Authorization": "Bearer ih_..."}
r = requests.get(
  "https://info-hub.io/api/v1/funding",
  headers=h, params={"symbols": "BTC"}
)
print(r.json()["data"])`,
              },
              {
                icon: Code2, iconColor: 'text-amber-400', label: 'JavaScript', labelExtra: 'fetch / Node',
                code: `const res = await fetch(
  "https://info-hub.io/api/v1/spreads",
  { headers: {
    Authorization: "Bearer ih_..."
  }}
);
const { data } = await res.json();
console.log(data);`,
              },
            ] as const).map(ex => (
              <div key={ex.label} className="bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] rounded-xl p-5 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <ex.icon className={`w-4 h-4 ${ex.iconColor}`} />
                  <h3 className="text-sm font-semibold text-gray-200">{ex.label}</h3>
                  <span className="text-[10px] text-gray-600 ml-auto">{ex.labelExtra}</span>
                </div>
                <div className="relative">
                  <CopyBtn text={ex.code} />
                  <pre className="bg-black/60 border border-white/[0.04] rounded-lg p-3.5 pr-10 text-[11px] text-green-400/90 font-mono overflow-x-auto leading-relaxed">
{ex.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Rate Limits */}
        <FadeIn className="mb-14 sm:mb-20" delay={100}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Rate Limits</h2>
            <p className="text-gray-500 text-sm mt-1">Generous free tier, no credit card required</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 relative">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <span className="text-white font-bold text-sm block">Free Tier</span>
                  <span className="text-gray-500 text-[11px]">Perfect for side projects</span>
                </div>
              </div>
              <div className="text-sm space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-gray-400">Requests / min</span>
                  <span className="text-white font-mono font-bold text-base">100</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-gray-400">Requests / day</span>
                  <span className="text-white font-mono font-bold text-base">5,000</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-400">Endpoints</span>
                  <span className="text-white font-semibold">All 14</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/[0.04] to-orange-500/[0.02] border border-amber-500/20 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 text-[10px] text-amber-400/70 font-bold px-2 py-0.5 border border-amber-500/20 rounded-full bg-amber-500/10 uppercase tracking-wider">
                Soon
              </div>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <span className="text-white font-bold text-sm block">Pro Tier</span>
                  <span className="text-gray-500 text-[11px]">For production trading systems</span>
                </div>
              </div>
              <div className="text-sm space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-amber-500/10">
                  <span className="text-gray-400">Requests / min</span>
                  <span className="text-white font-mono font-bold text-base">500</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-amber-500/10">
                  <span className="text-gray-400">Requests / day</span>
                  <span className="text-amber-300 font-bold">Unlimited</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-400">Support</span>
                  <span className="text-amber-300 font-semibold">Priority</span>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* FAQ */}
        <FadeIn className="mb-14 sm:mb-20" delay={100}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Common questions</h2>
          </div>
          <div className="space-y-2">
            <FaqItem
              q="Is the API free?"
              a="Yes. The free tier gives you 100 requests per minute and 5,000 per day with access to all 14 endpoints. No credit card required."
            />
            <FaqItem
              q="What format does the API return?"
              a='All endpoints return JSON with a consistent shape: { "success": true, "data": [...] }. Errors include a human-readable message field.'
            />
            <FaqItem
              q="How fresh is the data?"
              a="Most endpoints use an in-memory L1 cache with 3 to 10 second freshness. Funding rates update every few seconds. Historical endpoints cache for 5 minutes."
            />
            <FaqItem
              q="Do I need separate API keys for each exchange?"
              a="No. One InfoHub API key gives you aggregated data from all 33 exchanges. That's the whole point."
            />
            <FaqItem
              q="Is there a WebSocket API?"
              a="Not yet. The REST API is polled. We're evaluating WebSocket support for real-time funding and liquidation streams."
            />
            <FaqItem
              q="What happens if I hit the rate limit?"
              a="You'll get a 429 response with a Retry-After header. The limit resets every minute. Pro tier (coming soon) bumps this to 500/min with no daily cap."
            />
          </div>
        </FadeIn>

        {/* CTA Banner */}
        <FadeIn className="mb-14 sm:mb-20" delay={100}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-8 sm:p-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Ready to build?</h3>
                <p className="text-gray-400 text-sm max-w-md">
                  Create a free API key and start fetching real-time data from 33 exchanges in minutes.
                </p>
              </div>
              {session?.user ? (
                <button
                  onClick={() => document.getElementById('api-keys')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
                >
                  <Key className="w-4 h-4" /> Manage Keys <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Link
                  href="/login?callbackUrl=/developers"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
                >
                  <Key className="w-4 h-4" /> Get Free API Key <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </FadeIn>

        </div>{/* close max-w-6xl container */}
      </main>
      <Footer />
    </div>
  );
}
