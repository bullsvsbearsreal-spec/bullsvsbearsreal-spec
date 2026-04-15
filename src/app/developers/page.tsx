'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AuthPromptBanner from '@/components/AuthPromptBanner';
import {
  Key, Copy, Check, Trash2, Zap, BarChart3, TrendingUp, Shield, Clock, Globe,
  ArrowRight, Terminal, Code2, Activity, Layers, LineChart, AlertTriangle,
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

const ENDPOINT_GROUPS = [
  {
    label: 'Market Data',
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
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
    endpoints: [
      ['GET', '/api/v1/exchanges', 'Exchange metadata, fees & intervals'],
      ['GET', '/api/v1/status', 'API health status (no auth required)'],
    ],
  },
];

const FEATURES = [
  { icon: Zap, title: '33 Exchanges', desc: '18 CEX + 15 DEX aggregated in real-time', color: 'text-amber-400' },
  { icon: Clock, title: 'Sub-second', desc: 'In-memory L1 cache, 3-10s freshness', color: 'text-blue-400' },
  { icon: Shield, title: 'Rate Limited', desc: '100 req/min free, 500 req/min pro', color: 'text-green-400' },
  { icon: Activity, title: '14 Endpoints', desc: 'Funding, OI, spreads, liqs, options & more', color: 'text-purple-400' },
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
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8 sm:py-12">

        {/* ─── Hero ──────────────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live — 14 endpoints
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">InfoHub </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">Public API</span>
          </h1>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            Programmatic access to funding rates, open interest, liquidations, spreads, options, and arbitrage opportunities across 33 exchanges. Built for trading bots, dashboards, and research.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {session?.user ? (
              <button
                onClick={() => document.getElementById('api-keys')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                <Key className="w-4 h-4" /> Manage API Keys
              </button>
            ) : (
              <Link
                href="/login?callbackUrl=/developers"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                <Key className="w-4 h-4" /> Get API Key
              </Link>
            )}
            <Link
              href="/developers/docs"
              className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors"
            >
              <Code2 className="w-4 h-4" /> Full Documentation
            </Link>
          </div>
        </div>

        {/* ─── Feature pills ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12 sm:mb-16">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-center">
              <f.icon className={`w-5 h-5 ${f.color} mx-auto mb-2`} />
              <div className="text-white text-sm font-semibold">{f.title}</div>
              <div className="text-gray-500 text-xs mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* ─── Auth prompt (not signed in) ────────────────────── */}
        {!session?.user && (
          <AuthPromptBanner variant="api-key" dismissible={false} className="mb-8" />
        )}

        {/* ─── API Key Management (signed in) ─────────────────── */}
        {session?.user && (
          <div id="api-keys" className="mb-12 sm:mb-16 scroll-mt-20">
            {/* New key banner */}
            {newKey && (
              <div className="bg-green-950/40 border border-green-800/50 rounded-xl p-5 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-green-400 font-semibold text-sm">API Key Created — Copy it now</p>
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

        {/* ─── Endpoints by Category ─────────────────────────── */}
        <div className="mb-12 sm:mb-16">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">Endpoints</h2>
            <Link href="/developers/docs" className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1 transition-colors">
              Full docs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ENDPOINT_GROUPS.map(g => (
              <div key={g.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${g.bg}`}>
                    <g.icon className={`w-4 h-4 ${g.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{g.label}</h3>
                  <span className="text-[10px] text-gray-600 ml-auto">{g.endpoints.length} endpoints</span>
                </div>
                <div className="space-y-1.5">
                  {g.endpoints.map(([method, path, desc]) => (
                    <div key={path} className="flex items-start gap-2">
                      <code className="text-[10px] text-green-400/70 font-mono mt-0.5 shrink-0 w-6">{method}</code>
                      <div className="min-w-0">
                        <code className="text-xs text-amber-400/80 font-mono">{(path as string).replace('/api/v1/', '')}</code>
                        <p className="text-[11px] text-gray-500 leading-tight">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Quick Start ───────────────────────────────────── */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-xl font-bold mb-5">Quick Start</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-300">curl</h3>
              </div>
              <pre className="bg-black/50 rounded-lg p-3 text-[11px] text-green-400 font-mono overflow-x-auto leading-relaxed">
{`curl -H "Authorization: Bearer ih_..." \\
  "https://infohub.trade/api/v1/\\
arbitrage?grade=A,B"`}
              </pre>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-medium text-gray-300">Python</h3>
              </div>
              <pre className="bg-black/50 rounded-lg p-3 text-[11px] text-green-400 font-mono overflow-x-auto leading-relaxed">
{`import requests

h = {"Authorization": "Bearer ih_..."}
r = requests.get(
  "https://infohub.trade/api/v1/funding",
  headers=h, params={"symbols": "BTC"}
)
print(r.json()["data"])`}
              </pre>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-medium text-gray-300">JavaScript</h3>
              </div>
              <pre className="bg-black/50 rounded-lg p-3 text-[11px] text-green-400 font-mono overflow-x-auto leading-relaxed">
{`const res = await fetch(
  "https://infohub.trade/api/v1/spreads",
  { headers: {
    Authorization: "Bearer ih_..."
  }}
);
const { data } = await res.json();`}
              </pre>
            </div>
          </div>
        </div>

        {/* ─── Rate Limits ───────────────────────────────────── */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-5">Rate Limits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-white font-semibold text-sm">Free Tier</span>
              </div>
              <div className="text-gray-400 text-sm space-y-1.5">
                <div className="flex justify-between"><span>Requests / minute</span><span className="text-white font-mono">100</span></div>
                <div className="flex justify-between"><span>Requests / day</span><span className="text-white font-mono">5,000</span></div>
                <div className="flex justify-between"><span>Endpoints</span><span className="text-white">All 14</span></div>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-amber-500/20 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-2 right-2 text-[10px] text-amber-500/60 font-medium px-1.5 py-0.5 border border-amber-500/20 rounded">
                Coming soon
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
                <span className="text-white font-semibold text-sm">Pro Tier</span>
              </div>
              <div className="text-gray-400 text-sm space-y-1.5">
                <div className="flex justify-between"><span>Requests / minute</span><span className="text-white font-mono">500</span></div>
                <div className="flex justify-between"><span>Requests / day</span><span className="text-white">Unlimited</span></div>
                <div className="flex justify-between"><span>Support</span><span className="text-white">Priority</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
