'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Copy, Check, ArrowLeft, ChevronRight, ExternalLink, Link as LinkIcon } from 'lucide-react';

/* Copy button for code blocks */
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="absolute top-2.5 right-2.5 text-gray-600 hover:text-gray-300 transition-colors bg-black/60 backdrop-blur-sm border border-white/[0.06] rounded-md p-1.5 z-10"
      title="Copy"
    >
      {ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* Section with anchor link on hover */
function Section({ id, title, method, path, children }: {
  id: string; title: string; method?: string; path?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-24">
      <a href={`#${id}`} className="group flex items-center gap-2 mb-4 no-underline">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <LinkIcon className="w-4 h-4 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
      {method && path && (
        <div className="flex items-center gap-2.5 mb-5 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 w-fit relative pr-12">
          <span className="text-[11px] text-green-400 font-mono font-bold bg-green-500/[0.08] px-2 py-0.5 rounded">{method}</span>
          <code className="text-sm text-amber-400/90 font-mono">{path}</code>
          <CopyBtn text={`https://info-hub.io${path}`} />
        </div>
      )}
      {children}
    </section>
  );
}

/** Render JSON with cheap syntax highlighting: keys (purple),
 *  string values (green), numbers (amber), booleans (blue), null (gray).
 *  Done with regex replacements + dangerouslySetInnerHTML — no parser
 *  dependency, no AST tree, no performance cost on render. */
function highlightJson(src: string): string {
  // Escape any HTML in the source first so user-supplied content
  // can't inject markup. None of our examples have HTML in them,
  // but the rule of zero exceptions is cheaper than the bug class.
  const esc = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    // "key":
    .replace(/&quot;([^&]+?)&quot;(?=\s*:)/g, '<span style="color:#c084fc">&quot;$1&quot;</span>')
    // : "value"
    .replace(/(:\s*)&quot;([^&]*?)&quot;/g, '$1<span style="color:#86efac">&quot;$2&quot;</span>')
    // : number
    .replace(/(:\s*)(-?\d+(?:\.\d+)?)\b/g, '$1<span style="color:#fbbf24">$2</span>')
    // : true|false|null
    .replace(/(:\s*)(true|false)\b/g, '$1<span style="color:#60a5fa">$2</span>')
    .replace(/(:\s*)(null)\b/g, '$1<span style="color:#6b7280">$2</span>');
}

function CodeBlock({ children, title, lang }: { children: string; title?: string; lang?: string }) {
  // Auto-detect JSON: contents start with { or [ after trim → highlight.
  // Anything else (bash, js, etc.) renders as plain mono text.
  const trimmed = children.trim();
  const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  return (
    <div className="mb-5 relative">
      {title && <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">{title}</div>}
      <div className="relative group">
        <CopyBtn text={children.trim()} />
        {lang && (
          <span className="absolute top-2.5 left-3 text-[9px] text-gray-600 uppercase tracking-wider font-medium">{lang}</span>
        )}
        <pre className={`bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-4 pr-12 ${lang ? 'pt-7' : ''} text-[13px] ${isJson ? 'text-gray-300' : 'text-green-400/90'} font-mono overflow-x-auto whitespace-pre leading-relaxed`}>
          {isJson
            ? <span dangerouslySetInnerHTML={{ __html: highlightJson(children) }} />
            : children}
        </pre>
      </div>
    </div>
  );
}

function ParamTable({ params }: { params: Array<[string, string, string, string]> }) {
  return (
    <div className="overflow-x-auto mb-5 bg-white/[0.01] border border-white/[0.04] rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-white/[0.06] text-[10px] uppercase tracking-widest">
            <th className="text-left py-3 px-4 font-medium">Parameter</th>
            <th className="text-left py-3 pr-4 font-medium">Type</th>
            <th className="text-left py-3 pr-4 font-medium">Default</th>
            <th className="text-left py-3 pr-4 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="text-gray-300">
          {params.map(([name, type, def, desc], i) => (
            <tr key={name} className={i < params.length - 1 ? 'border-b border-white/[0.03]' : ''}>
              <td className="py-3 px-4"><code className="text-amber-400 text-xs bg-amber-500/[0.08] px-1.5 py-0.5 rounded font-medium">{name}</code></td>
              <td className="py-3 pr-4 text-purple-300/70 text-xs font-mono">{type}</td>
              <td className="py-3 pr-4 text-gray-600 text-xs font-mono">{def}</td>
              <td className="py-3 pr-4 text-gray-400 text-[13px]">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Hook to track which section is in view for sidebar highlighting */
function useActiveSection(sectionIds: string[]) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    );
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionIds]);
  return active;
}

const NAV_SECTIONS = [
  { group: 'Getting Started', items: [
    { id: 'authentication', label: 'Authentication' },
    { id: 'rate-limits', label: 'Rate Limits' },
    { id: 'response-format', label: 'Response Format' },
    { id: 'fee-model', label: 'Fee Model' },
  ]},
  { group: 'Market Data', items: [
    { id: 'funding', label: 'Funding Rates' },
    { id: 'openinterest', label: 'Open Interest' },
    { id: 'tickers', label: 'Tickers' },
    { id: 'klines', label: 'Klines (OHLCV)' },
    { id: 'spreads', label: 'Spreads' },
  ]},
  { group: 'Trading Intelligence', items: [
    { id: 'arbitrage', label: 'Arbitrage' },
    { id: 'funding-arb', label: 'Funding Arbitrage' },
    { id: 'longshort', label: 'Long/Short Ratio' },
    { id: 'liquidations', label: 'Liquidations' },
    { id: 'options', label: 'Options' },
    { id: 'basis', label: 'CME Basis' },
  ]},
  { group: 'Market Context', items: [
    { id: 'top-movers', label: 'Top Movers' },
    { id: 'global-stats', label: 'Global Stats' },
    { id: 'fear-greed', label: 'Fear & Greed' },
    { id: 'funding-history', label: 'Funding History' },
    { id: 'listing-radar', label: 'Listing Radar' },
    { id: 'earnings-calendar', label: 'Events Calendar' },
  ]},
  { group: 'On-chain & Yield', items: [
    { id: 'whales', label: 'Whale Trades' },
    { id: 'whale-liq', label: 'Whale Liquidation Roulette' },
    { id: 'smart-money-leaderboard', label: 'Smart Money' },
    { id: 'bridge-flows', label: 'Bridge Flows' },
    { id: 'restaking', label: 'Restaking Yields' },
  ]},
  { group: 'Tools', items: [
    { id: 'backtest', label: 'Backtest' },
  ]},
  { group: 'Reference', items: [
    { id: 'exchanges', label: 'Exchanges' },
    { id: 'status', label: 'Status' },
    { id: 'error-codes', label: 'Error Codes' },
  ]},
];

export default function DocsPage() {
  const allIds = NAV_SECTIONS.flatMap(g => g.items.map(i => i.id));
  const activeSection = useActiveSection(allIds);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex gap-0 lg:gap-0">

          {/* Sidebar nav */}
          <aside className="hidden lg:block w-60 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-6 border-r border-white/[0.04]">
            <Link href="/developers" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-6 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to API
            </Link>
            <nav className="space-y-5 pb-8">
              {NAV_SECTIONS.map(g => (
                <div key={g.group}>
                  <div className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-2 px-3">{g.group}</div>
                  <div className="space-y-0.5">
                    {g.items.map(item => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`block text-[13px] px-3 py-1.5 rounded-lg transition-all border-l-2 ${
                          activeSection === item.id
                            ? 'text-amber-400 bg-amber-500/[0.06] border-amber-400 font-medium'
                            : 'text-gray-400 hover:text-white hover:bg-white/[0.03] border-transparent'
                        }`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main id="main-content" className="flex-1 min-w-0 lg:pl-10">

            {/* Mobile back link */}
            <Link href="/developers" className="lg:hidden inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-4 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to API
            </Link>

            {/* Header */}
            <div className="mb-12 pb-10 border-b border-white/[0.04]">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/15 bg-amber-500/[0.05] text-amber-300/80 text-[11px] font-medium mb-4">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-amber-400" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.35)]" />
                </span>
                v1 reference, kept in sync
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                <span className="text-white">API </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Documentation</span>
              </h1>
              <p className="text-gray-400 text-base max-w-2xl mb-4">
                Complete reference for the InfoHub Public API. Real-time derivatives data from 32 exchanges, aggregated into 26 REST endpoints.
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-6">
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Base URL</span>
                  <code className="text-amber-400/80 text-sm font-mono">https://info-hub.io/api/v1</code>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Format</span>
                  <span className="text-white text-sm">JSON</span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Auth</span>
                  <span className="text-white text-sm">Bearer Token</span>
                </div>
                <a
                  href="https://info-hub.io/api/v1/openapi"
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] hover:border-amber-500/40 hover:bg-amber-500/[0.04] rounded-lg px-3 py-2 transition-colors group"
                >
                  <span className="text-[10px] text-gray-500 group-hover:text-amber-400/80 uppercase tracking-wider font-medium transition-colors">OpenAPI 3.1</span>
                  <span className="text-white group-hover:text-amber-400 text-sm transition-colors">/api/v1/openapi</span>
                  <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-amber-400 transition-colors" />
                </a>
              </div>

              {/* What's new — highlight the major v1 surface upgrades partners
                  should know about. Keep this list short and date-stamped so
                  the next time we ship something significant we know what to
                  replace. */}
              <div className="bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.04] border border-amber-500/15 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-amber-400/80 uppercase tracking-widest font-bold">What&apos;s new</span>
                  <span className="text-[10px] text-gray-600 font-mono">May 2026</span>
                </div>
                <ul className="space-y-2 text-[13px] text-gray-300">
                  <li className="flex items-start gap-2.5">
                    <span className="text-amber-400 mt-1.5 flex-shrink-0">●</span>
                    <span>
                      <strong className="text-white">Fee model surface</strong> — every fee-aware endpoint now returns
                      <code className="text-amber-400 mx-1">meta.feeModel</code> with a version identifier and the full
                      schedule. <a href="#fee-model" className="text-amber-400 hover:underline">Read &nbsp;→</a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-amber-400 mt-1.5 flex-shrink-0">●</span>
                    <span>
                      <strong className="text-white">Aggregate modes</strong> on funding / open-interest / tickers —
                      pass <code className="text-amber-400">?aggregate=1</code> for one row per symbol.
                      <a href="#funding" className="text-amber-400 hover:underline ml-1">Read &nbsp;→</a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-amber-400 mt-1.5 flex-shrink-0">●</span>
                    <span>
                      <strong className="text-white">/klines endpoint</strong> with Binance → Bybit → OKX fallback.
                      <a href="#klines" className="text-amber-400 hover:underline ml-1">Read &nbsp;→</a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-amber-400 mt-1.5 flex-shrink-0">●</span>
                    <span>
                      <strong className="text-white">Long/short regime classifier</strong> — every <code className="text-amber-400">/longshort</code>{' '}
                      response now includes a <code className="text-amber-400">regime</code> field
                      (crowded-long / balanced / crowded-short).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-amber-400 mt-1.5 flex-shrink-0">●</span>
                    <span>
                      <strong className="text-white">Liquidation summary mode</strong> — <code className="text-amber-400">/liquidations?summary=1</code>{' '}
                      returns aggregated stats instead of paging through the feed.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Mobile TOC */}
            <div className="lg:hidden bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-10">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">On this page</div>
              <div className="grid grid-cols-2 gap-1">
                {NAV_SECTIONS.flatMap(g => g.items).map(item => (
                  <a key={item.id} href={`#${item.id}`} className="text-[13px] text-gray-400 hover:text-amber-400 py-1 transition-colors">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Authentication */}
            <Section id="authentication" title="Authentication">
              <p className="text-gray-400 mb-4">
                All endpoints except <code className="text-amber-400 text-xs bg-amber-500/[0.08] px-1.5 py-0.5 rounded">/status</code> require an API key passed as a Bearer token in the Authorization header.
              </p>
              <CodeBlock title="Header format">{`Authorization: Bearer ih_your_api_key_here`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400 space-y-2">
                <p>Keys start with <code className="text-amber-400">ih_</code> and are 36 characters long.</p>
                <p>Generate up to 5 keys at <Link href="/developers" className="text-amber-400 hover:underline">/developers</Link>.</p>
                <p>Keys are hashed server side. The full key is shown once at creation. Store it securely.</p>
              </div>
            </Section>

            {/* Rate Limits */}
            <Section id="rate-limits" title="Rate Limits">
              <p className="text-gray-400 mb-4">Every response includes rate limit headers:</p>
              <CodeBlock>{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1709248060`}</CodeBlock>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-white font-semibold text-sm mb-2">Free Tier</div>
                  <div className="text-gray-400 text-[13px] space-y-1">
                    <div className="flex justify-between"><span>Per minute</span><span className="text-white font-mono">100</span></div>
                    <div className="flex justify-between"><span>Per day</span><span className="text-white font-mono">5,000</span></div>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-amber-500/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white font-semibold text-sm">Pro Tier</span>
                    <span className="text-[9px] text-amber-400/70 border border-amber-500/20 rounded-full px-1.5 py-0.5 uppercase font-bold tracking-wider">Soon</span>
                  </div>
                  <div className="text-gray-400 text-[13px] space-y-1">
                    <div className="flex justify-between"><span>Per minute</span><span className="text-white font-mono">500</span></div>
                    <div className="flex justify-between"><span>Per day</span><span className="text-amber-300">Unlimited</span></div>
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-[13px]">
                Exceeding the limit returns <code className="text-amber-400">429</code> with a <code className="text-amber-400">Retry-After</code> header indicating seconds until the window resets.
              </p>
            </Section>

            {/* Response Format */}
            <Section id="response-format" title="Response Format">
              <p className="text-gray-400 mb-4">All endpoints return JSON with a consistent structure:</p>
              <CodeBlock title="Success">{`{
  "success": true,
  "data": [ ... ],
  "meta": { "timestamp": 1709248000, ... }
}`}</CodeBlock>
              <CodeBlock title="Error">{`{
  "success": false,
  "error": "Human-readable error message"
}`}</CodeBlock>
              <p className="text-gray-500 text-[13px]">
                The <code className="text-amber-400">meta</code> field is optional and varies by endpoint. It may include counts, timestamps, or filter summaries.
              </p>
            </Section>

            {/* Fee Model */}
            <Section id="fee-model" title="Fee Model">
              <p className="text-gray-400 mb-4">
                Fee-sensitive endpoints (<code className="text-amber-400">/arbitrage</code>,
                <code className="text-amber-400 mx-1">/spreads</code>,
                <code className="text-amber-400">/funding-arb</code>) expose the fee schedule
                they used to compute net P&amp;L so callers can verify the
                assumption or recompute under their own fill model.
              </p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400 mb-4 space-y-2">
                <p><strong className="text-white">Unit.</strong> All fee values are percent-per-trade.
                  <code className="text-amber-400 mx-1">0.05</code> means <code className="text-amber-400">0.05%</code>,
                  not <code className="text-amber-400">5%</code>. Maker fees may be negative on venues that rebate makers.</p>
                <p><strong className="text-white">Version bumps.</strong> The
                  <code className="text-amber-400 mx-1">meta.feeModel.version</code> string changes
                  whenever any value in our internal fee table changes — including a single venue's taker rate.
                  Format is <code className="text-amber-400">vMAJOR.MINOR-YYYY-MM-DD</code>.</p>
                <p><strong className="text-white">Headers.</strong> The same identifiers are mirrored on
                  <code className="text-amber-400 mx-1">X-Fee-Model-Version</code> and
                  <code className="text-amber-400">X-Fee-Model-Updated-At</code> response headers,
                  so a cheap HEAD request is enough to detect a bump.</p>
                <p><strong className="text-white">Where it appears.</strong> Same shape on every fee-sensitive
                  endpoint: <code className="text-amber-400">meta.feeModel = {`{ version, updatedAt, unit, schedule }`}</code>.
                  <code className="text-amber-400 mx-1">/status</code> and
                  <code className="text-amber-400">/exchanges</code> emit just the identifiers (no schedule)
                  so you can probe cheaply.</p>
              </div>
              <CodeBlock title="meta.feeModel shape">{`{
  "version": "v1.0-2026-02-01",
  "updatedAt": "2026-02-01T00:00:00Z",
  "unit": "percent",
  "schedule": {
    "Binance":      { "maker": 0.0200, "taker": 0.0500 },
    "Bybit":        { "maker": 0.0200, "taker": 0.0550 },
    "Hyperliquid":  { "maker": 0.0150, "taker": 0.0450 },
    "Nado":         { "maker": -0.0080, "taker": 0.0150 }
  }
}`}</CodeBlock>
              <CodeBlock title="Detect a fee bump (curl)" lang="bash">{`# Lightweight HEAD probe — no body, just the version header
curl -sI -H "Authorization: Bearer ih_xxx" \\
  https://info-hub.io/api/v1/status \\
  | grep -i "x-fee-model-version"

# Output:
# X-Fee-Model-Version: v1.0-2026-02-01
# X-Fee-Model-Updated-At: 2026-02-01T00:00:00Z`}</CodeBlock>
              <CodeBlock title="Recompute net under maker-only fills (JS)" lang="js">{`// Use the per-side fees in each arbitrage row to back out a maker-only net
const row = data[0];
const makerRoundTrip =
  (row.fees.shortExchangeMaker ?? row.fees.shortExchangeTaker) +
  (row.fees.longExchangeMaker  ?? row.fees.longExchangeTaker);
// Round-trip = open + close on each side = 4 fills total
const netSpreadMakerOnly = row.grossSpread8h - makerRoundTrip * 2;

// Cache key for downstream models — refresh when this changes
const cacheKey = \`fee:\${meta.feeModel.version}\`;`}</CodeBlock>
            </Section>

            {/* Funding Rates */}
            {/* Market Data */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-blue-400/70 uppercase tracking-widest font-bold">Market Data</div>
              <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 to-transparent" />
            </div>

            <Section id="funding" title="Funding Rates" method="GET" path="/api/v1/funding">
              <p className="text-gray-400 mb-4">Real-time funding rates across 32 exchanges. Rates are expressed as percentages in the exchange's native interval.</p>
              <ParamTable params={[
                ['symbols', 'string', 'all', 'Comma-separated symbols (e.g. BTC,ETH,SOL)'],
                ['exchanges', 'string', 'all', 'Comma-separated exchanges (e.g. binance,bybit)'],
                ['assetClass', 'string', 'crypto', 'crypto, stocks, forex, commodities, or all'],
                ['aggregate', 'number', '0', '1 = one row per symbol with avg/min/max rate8h'],
              ]} />
              <CodeBlock title="Response (per-venue, default)">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "rate": 0.0100,
      "rate8h": 0.0100,
      "predictedRate": 0.0085,
      "markPrice": 95000.50,
      "indexPrice": 94980.25,
      "fundingInterval": "8h",
      "nextFundingTime": 1709251200000,
      "type": "cex",
      "assetClass": "crypto"
    }
  ],
  "meta": { "timestamp": 1709248000, "exchanges": 24, "pairs": 6466, "mode": "per-venue" }
}`}</CodeBlock>
              <CodeBlock title="Response (aggregate=1)">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "venueCount": 14,
      "avgRate8h": 0.0185,
      "minRate8h": -0.0245,
      "minExchange": "Hyperliquid",
      "maxRate8h": 0.0567,
      "maxExchange": "Bybit",
      "spread8h": 0.0812
    }
  ],
  "meta": { "timestamp": 1709248000, "entries": 230, "mode": "aggregate", "assetClass": "crypto" }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                Aggregate mode is sorted by <code className="text-amber-400">spread8h</code> descending,
                so the widest opportunities surface first. All rates are 8h-normalised, so 1h and 4h
                venues compare directly with the typical 8h CEX rate.
              </div>
            </Section>

            {/* Open Interest */}
            <Section id="openinterest" title="Open Interest" method="GET" path="/api/v1/openinterest">
              <p className="text-gray-400 mb-4">
                Open interest across exchanges in USD. Per-venue rows by default;
                pass <code className="text-amber-400">aggregate=1</code> to get one
                row per symbol (with the per-venue breakdown nested inside), or
                <code className="text-amber-400 mx-1">changes=1</code> to include
                1h / 4h / 24h % deltas computed from server-side snapshots.
              </p>
              <ParamTable params={[
                ['symbols', 'string', 'all', 'Comma-separated symbols'],
                ['exchanges', 'string', 'all', 'Comma-separated exchanges'],
                ['aggregate', 'number', '0', '1 = one row per symbol with summed openInterestUsd'],
                ['changes', 'number', '0', '1 = include {pct1h, pct4h, pct24h} on each row'],
              ]} />
              <CodeBlock title="Response (per-venue, default)">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "openInterest": 4200000000,
      "openInterestUsd": 4200000000,
      "timestamp": 1713181800000
    }
  ],
  "meta": { "timestamp": 1713181800000, "entries": 420, "exchanges": 26, "mode": "per-venue" }
}`}</CodeBlock>
              <CodeBlock title="Response (aggregate=1)">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "openInterestUsd": 40250000000,
      "venueCount": 14,
      "venues": [
        { "exchange": "Binance", "openInterestUsd": 7870000000 },
        { "exchange": "Bybit",   "openInterestUsd": 4280000000 }
      ],
      "timestamp": 1713181800000,
      "changes": { "pct1h": 0.42, "pct4h": -1.83, "pct24h": 5.21 }
    }
  ],
  "meta": { "timestamp": 1713181800000, "entries": 230, "mode": "aggregate", "changesAvailable": true }
}`}</CodeBlock>
            </Section>

            {/* Tickers */}
            <Section id="tickers" title="Tickers" method="GET" path="/api/v1/tickers">
              <p className="text-gray-400 mb-4">
                Real-time price and volume data across exchanges. Per-venue rows by
                default; pass <code className="text-amber-400">aggregate=1</code> to
                get one row per symbol with median price, max H, min L, and cross-venue
                deduped 24h volume ($100B per-entry sanity cap to filter mis-reported figures).
              </p>
              <ParamTable params={[
                ['symbols', 'string', 'all', 'Comma-separated symbols (e.g. BTC,ETH)'],
                ['exchanges', 'string', 'all', 'Comma-separated exchanges'],
                ['aggregate', 'number', '0', '1 = one row per symbol with summed volume'],
              ]} />
              <CodeBlock title="Response (per-venue, default)">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "lastPrice": 84250.50,
      "high24h": 85100.00,
      "low24h": 83200.00,
      "volume24h": 12500000000,
      "priceChange24hPct": 1.25
    }
  ],
  "meta": { "timestamp": 1713181800000, "entries": 380, "mode": "per-venue" }
}`}</CodeBlock>
              <CodeBlock title="Response (aggregate=1)">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "lastPrice": 84250.50,
      "high24h": 85100.00,
      "low24h": 83200.00,
      "volume24h": 38400000000,
      "priceChange24hPct": 1.27,
      "venueCount": 14
    }
  ],
  "meta": { "timestamp": 1713181800000, "entries": 230, "mode": "aggregate" }
}`}</CodeBlock>
            </Section>

            {/* Klines */}
            <Section id="klines" title="Klines (OHLCV)" method="GET" path="/api/v1/klines">
              <p className="text-gray-400 mb-4">
                OHLCV candle data backed by a multi-venue fallback chain
                (Binance perp → Bybit → OKX → Binance spot). A single venue
                outage doesn't break the response — the upstream that
                served the response is named in <code className="text-amber-400">data.source</code>.
              </p>
              <ParamTable params={[
                ['symbol', 'string', 'required', 'Base symbol (USDT pair appended internally)'],
                ['interval', 'string', '1h', '1m | 5m | 15m | 1h | 4h | 1d | 1w'],
                ['limit', 'number', '100', 'Max candles (1 to 500)'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "pair": "BTCUSDT",
    "interval": "1h",
    "source": "binance",
    "count": 100,
    "candles": [
      {
        "time": 1778493600000,
        "open": 80923.30,
        "high": 81162.40,
        "low": 80889.90,
        "close": 80900.80,
        "volume": 3424.195,
        "closeTime": 1778497199999
      }
    ]
  },
  "meta": { "timestamp": 1778493700000 }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                Times are Unix milliseconds. Volume is denominated in the BASE asset
                (BTC for BTCUSDT) — multiply by close price for USD notional. Use
                <code className="text-amber-400 mx-1">data.source</code> to detect
                when the primary venue is down and your indicator math is sitting
                on a fallback's data shape.
              </div>
            </Section>

            {/* Spreads */}
            <Section id="spreads" title="Spreads" method="GET" path="/api/v1/spreads">
              <p className="text-gray-400 mb-4">
                Cross-exchange price spreads ranked by opportunity size. Returns
                both gross spread and net spread (after round-trip taker fees on
                both legs), plus per-side maker + taker so callers can recompute
                under their own fill model.
              </p>
              <ParamTable params={[
                ['symbols', 'string', 'all', 'Comma-separated symbols'],
                ['minSpread', 'number', '0', 'Minimum GROSS spread % to include'],
                ['limit', 'number', '50', 'Max results (1 to 200)'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "spreadPct": 0.0312,
      "spreadUsd": 26.30,
      "netSpreadPct": -0.0688,
      "highExchange": "Bitfinex",
      "highPrice": 84276.30,
      "lowExchange": "Binance",
      "lowPrice": 84250.00,
      "exchangeCount": 18,
      "fees": {
        "roundTrip": 0.1000,
        "highExchangeTaker": 0.0000,
        "highExchangeMaker": 0.0000,
        "lowExchangeTaker":  0.0500,
        "lowExchangeMaker":  0.0200
      }
    }
  ],
  "meta": {
    "feeModel": {
      "version": "v1.0-2026-02-01",
      "updatedAt": "2026-02-01T00:00:00Z",
      "unit": "percent",
      "schedule": { /* full venue table */ }
    }
  }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                Note: spreads can have NEGATIVE <code className="text-amber-400">netSpreadPct</code> when
                fees outweigh the price difference — that's the signal that the
                opportunity isn't actionable on taker liquidity. Bump-detect on
                <code className="text-amber-400 mx-1">meta.feeModel.version</code>
                to know when to invalidate cached calcs.
              </div>
            </Section>

            {/* Arbitrage */}
            {/* Trading Intelligence */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-green-400/70 uppercase tracking-widest font-bold">Trading Intelligence</div>
              <div className="flex-1 h-px bg-gradient-to-r from-green-500/20 to-transparent" />
            </div>

            <Section id="arbitrage" title="Arbitrage" method="GET" path="/api/v1/arbitrage">
              <p className="text-gray-400 mb-4">
                Funding rate arbitrage opportunities with feasibility grades, PnL projections, and OI data.
                Short the high-rate exchange, long the low-rate exchange.
              </p>
              <ParamTable params={[
                ['minSpread', 'number', '0', 'Minimum 8h spread % (e.g. 0.05)'],
                ['minOI', 'number', '0', 'Minimum OI in USD on the smaller side'],
                ['grade', 'string', 'all', 'Filter by grade: A, B, C, D (comma-separated)'],
                ['symbols', 'string', 'all', 'Comma-separated symbols'],
                ['limit', 'number', '100', 'Max results (1 to 500)'],
                ['assetClass', 'string', 'crypto', 'Asset class filter'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": [
    {
      "symbol": "PONKE",
      "shortExchange": "Kraken",
      "longExchange": "Bitunix",
      "shortRate8h": 0.5032,
      "longRate8h": 0.0000,
      "grossSpread8h": 0.5032,
      "netSpread8h": 0.2832,
      "annualizedPct": 310.1,
      "dailyPnlPer10k": 8.50,
      "fees": {
        "roundTrip": 0.2200,
        "shortExchangeTaker": 0.0500,
        "shortExchangeMaker": 0.0200,
        "longExchangeTaker":  0.0600,
        "longExchangeMaker":  0.0200,
        "shortExchangeFee":   0.0500,
        "longExchangeFee":    0.0600
      },
      "oi": {
        "short": 500000,
        "long": 120000,
        "total": 620000,
        "minSide": 120000
      },
      "grade": "C",
      "stability": "volatile",
      "exchangeCount": 5,
      "allExchanges": [
        {
          "exchange": "Kraken",
          "rate8h": 0.5032,
          "type": "cex",
          "makerFee": 0.0200,
          "takerFee": 0.0500
        }
      ]
    }
  ],
  "meta": {
    "totalPairs": 657,
    "filtered": 50,
    "grades": { "A": 0, "B": 1, "C": 120, "D": 536 },
    "feeModel": {
      "version": "v1.0-2026-02-01",
      "updatedAt": "2026-02-01T00:00:00Z",
      "unit": "percent",
      "schedule": {
        "Binance":     { "maker": 0.0200, "taker": 0.0500 },
        "Hyperliquid": { "maker": 0.0150, "taker": 0.0450 }
      }
    }
  }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400 mb-4">
                <div className="text-white font-semibold text-sm mb-2">Fee model</div>
                <p className="mb-2">
                  All fee values are percent-per-trade (e.g. <code className="text-amber-400">0.05</code> means <code className="text-amber-400">0.05%</code>).
                  Maker may be negative on venues that rebate makers.
                </p>
                <p className="mb-2">
                  <code className="text-amber-400">netSpread8h</code> = <code className="text-amber-400">grossSpread8h - roundTrip</code>, where round-trip assumes
                  taker fills (open + close on each side, so taker × 4).
                </p>
                <p>
                  Use <code className="text-amber-400">meta.feeModel.version</code> to detect schedule bumps —
                  it changes whenever any <code className="text-amber-400">EXCHANGE_FEES</code> value changes. The
                  same identifier is on the <code className="text-amber-400">X-Fee-Model-Version</code> response
                  header for cheap HEAD checks.
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                <div className="text-white font-semibold text-sm mb-2">Grade system</div>
                <div className="space-y-1.5">
                  <div><span className="text-green-400 font-mono font-bold">A</span> &nbsp;High OI, realistic spread, stable history</div>
                  <div><span className="text-blue-400 font-mono font-bold">B</span> &nbsp;Good OI, moderate spread, mostly stable</div>
                  <div><span className="text-amber-400 font-mono font-bold">C</span> &nbsp;Lower OI or volatile, still actionable</div>
                  <div><span className="text-red-400 font-mono font-bold">D</span> &nbsp;Fees exceed spread or very low OI</div>
                </div>
              </div>
            </Section>

            {/* Long/Short Ratio */}
            <Section id="longshort" title="Long/Short Ratio" method="GET" path="/api/v1/longshort">
              <p className="text-gray-400 mb-4">
                Long/short ratio data from Binance and OKX with historical values.
                Includes a derived <code className="text-amber-400">longShortRatio</code>
                (long ÷ short) and a <code className="text-amber-400">regime</code>
                classifier so callers don't have to bucket the values themselves.
              </p>
              <ParamTable params={[
                ['symbol', 'string', 'BTC', 'Symbol (e.g. BTC, ETH, SOL)'],
                ['period', 'string', '1h', 'Time period: 5m, 15m, 30m, 1h, 4h, 1d'],
                ['source', 'string', 'global', 'Data source: global, topTraders, taker'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "symbol": "BTC",
    "period": "1h",
    "source": "global",
    "longRatio": 52.34,
    "shortRatio": 47.66,
    "longShortRatio": 1.098,
    "regime": "balanced",
    "exchange": "binance",
    "history": [
      { "longRatio": 52.1, "shortRatio": 47.9, "longShortRatio": 1.088, "timestamp": 1709244000 },
      { "longRatio": 52.34, "shortRatio": 47.66, "longShortRatio": 1.098, "timestamp": 1709247600 }
    ]
  }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                <div className="text-white font-semibold text-sm mb-2">Regime buckets</div>
                <ul className="space-y-1">
                  <li><code className="text-amber-400">crowded-long</code> — longRatio ≥ 70%</li>
                  <li><code className="text-amber-400">long-heavy</code> — 60–70%</li>
                  <li><code className="text-amber-400">balanced</code> — 40–60%</li>
                  <li><code className="text-amber-400">short-heavy</code> — 30–40%</li>
                  <li><code className="text-amber-400">crowded-short</code> — longRatio ≤ 30%</li>
                </ul>
              </div>
            </Section>

            {/* Liquidations */}
            <Section id="liquidations" title="Liquidations" method="GET" path="/api/v1/liquidations">
              <p className="text-gray-400 mb-4">
                Recent liquidation events from the database. Sources: Binance, OKX, HTX,
                gTrade, Deribit. Two modes:
                <strong className="text-white"> feed</strong> (default) returns individual
                events; <strong className="text-white">summary</strong> returns aggregated
                stats (total / long / short volume + largest single hit) for a symbol over
                the lookback window — useful when you only want counts, not the full feed.
              </p>
              <ParamTable params={[
                ['symbol', 'string', 'all', 'Filter by symbol (required for summary mode)'],
                ['exchange', 'string', 'all', 'Filter by exchange (feed only)'],
                ['side', 'string', 'all', 'Filter by side: long or short (feed only)'],
                ['hours', 'number', '1', 'Lookback window (1 to 24 hours)'],
                ['limit', 'number', '100', 'Max entries (1 to 500; feed only)'],
                ['summary', 'number', '0', '1 = aggregated stats instead of feed'],
              ]} />
              <CodeBlock title="Response (feed mode, default)">{`{
  "success": true,
  "data": [
    {
      "symbol": "ETH",
      "exchange": "binance",
      "side": "long",
      "quantity": 12.5,
      "price": 3245.80,
      "valueUsd": 40572.50,
      "timestamp": 1713181800000
    }
  ],
  "meta": { "timestamp": 1713181800000, "hours": 1, "entries": 1, "limit": 100, "mode": "feed" }
}`}</CodeBlock>
              <CodeBlock title="Response (summary=1, requires symbol)">{`{
  "success": true,
  "data": {
    "symbol": "BTC",
    "hours": 1,
    "totalCount": 247,
    "totalVolumeUsd": 8420000,
    "longVolumeUsd": 6210000,
    "shortVolumeUsd": 2210000,
    "longShare": 0.737,
    "largest": {
      "valueUsd": 425000,
      "price": 81250.00,
      "side": "long",
      "exchange": "binance",
      "timestamp": 1713181500000
    }
  },
  "meta": { "timestamp": 1713181800000, "mode": "summary" }
}`}</CodeBlock>
            </Section>

            {/* Options */}
            <Section id="options" title="Options" method="GET" path="/api/v1/options">
              <p className="text-gray-400 mb-4">Options market data across Deribit, Binance, OKX, and Bybit. Includes max pain, put/call ratio, open interest by strike, and implied volatility.</p>
              <ParamTable params={[
                ['currency', 'string', 'BTC', 'Currency: BTC, ETH, or SOL'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "currency": "BTC",
    "underlyingPrice": 84250,
    "maxPain": 85000,
    "putCallRatio": 0.72,
    "totalCallOI": 7200000000,
    "totalPutOI": 5300000000,
    "totalOI": 12500000000,
    "instrumentCount": 4500,
    "ivAtm": 48.5,
    "exchanges": [
      { "exchange": "Deribit", "callOI": 5100000000, "putOI": 3800000000, "totalOI": 8900000000, "share": 71.2 }
    ],
    "expirations": [
      { "date": "2026-04-25", "callOI": 450000000, "putOI": 320000000, "totalOI": 770000000, "maxPain": 84000 }
    ]
  }
}`}</CodeBlock>
            </Section>

            {/* Top Movers */}
            {/* Market Context */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-purple-400/70 uppercase tracking-widest font-bold">Market Context</div>
              <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent" />
            </div>

            <Section id="top-movers" title="Top Movers" method="GET" path="/api/v1/top-movers">
              <p className="text-gray-400 mb-4">Top gaining and losing coins by 24h price change.</p>
              <ParamTable params={[
                ['limit', 'number', '20', 'Max gainers and losers each (1 to 50)'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "gainers": [
      { "symbol": "PEPE", "price": 0.0000089, "change24h": 24.5 }
    ],
    "losers": [
      { "symbol": "DOGE", "price": 0.162, "change24h": -8.2 }
    ]
  }
}`}</CodeBlock>
            </Section>

            {/* Global Stats */}
            <Section id="global-stats" title="Global Stats" method="GET" path="/api/v1/global-stats">
              <p className="text-gray-400 mb-4">Market-wide statistics: altcoin season index, BTC dominance, total market cap, 24h volume.</p>
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "altcoinSeasonIndex": 38,
    "btcDominance": 57.2,
    "ethDominance": 8.1,
    "totalMarketCap": 2850000000000,
    "totalMarketCapChange24h": -1.2,
    "totalVolume24h": 98000000000,
    "totalDerivativesOI": 55000000000,
    "activeCryptocurrencies": 10200
  }
}`}</CodeBlock>
            </Section>

            {/* Fear & Greed */}
            <Section id="fear-greed" title="Fear & Greed" method="GET" path="/api/v1/fear-greed">
              <p className="text-gray-400 mb-4">Crypto Fear & Greed Index with optional 30-day history.</p>
              <ParamTable params={[
                ['history', 'boolean', 'false', 'Include 30 day historical values'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "value": 72,
    "label": "Greed",
    "timestamp": 1709248000,
    "history": [
      { "value": 68, "label": "Greed", "timestamp": 1709161600 }
    ]
  }
}`}</CodeBlock>
            </Section>

            {/* Funding History */}
            <Section id="funding-history" title="Funding History" method="GET" path="/api/v1/funding/history">
              <p className="text-gray-400 mb-4">Historical funding rate snapshots from the database. 10-minute resolution, up to 14 days of lookback.</p>
              <ParamTable params={[
                ['symbols', 'string', '(required)', 'Comma-separated symbols (max 20)'],
                ['days', 'number', '7', 'Lookback period (1 to 14)'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": {
    "BTC": [
      { "day": "2026-04-13", "rate": 0.0082 },
      { "day": "2026-04-14", "rate": 0.0100 }
    ],
    "ETH": [
      { "day": "2026-04-13", "rate": 0.0045 },
      { "day": "2026-04-14", "rate": 0.0061 }
    ]
  },
  "meta": { "timestamp": 1713181800000, "symbols": 2, "days": 7 }
}`}</CodeBlock>
            </Section>

            {/* Exchanges */}
            {/* Reference */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-gray-400/70 uppercase tracking-widest font-bold">Reference</div>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-500/20 to-transparent" />
            </div>

            <Section id="exchanges" title="Exchanges" method="GET" path="/api/v1/exchanges">
              <p className="text-gray-400 mb-4">
                Metadata for all 32 supported exchanges including fees, funding intervals, trade URL patterns,
                and a top-level <code className="text-amber-400">feeModel</code> with the schedule version + last-updated timestamp.
              </p>
              <CodeBlock title="Response">{`{
  "success": true,
  "data": [
    {
      "name": "Binance",
      "type": "cex",
      "fees": { "takerPct": 0.05, "makerPct": 0.02, "roundTripPct": 0.10 },
      "fundingInterval": "8h",
      "tradeUrlPattern": "https://www.binance.com/en/futures/{SYMBOL}USDT"
    }
  ],
  "meta": {
    "total": 32, "cex": 18, "dex": 14,
    "timestamp": 1713181800000,
    "feeModel": {
      "version": "v1.0-2026-02-01",
      "updatedAt": "2026-02-01T00:00:00Z",
      "unit": "percent"
    }
  }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                This endpoint is the canonical fee-schedule source — partners can cache
                by <code className="text-amber-400">meta.feeModel.version</code> and only
                refresh when it bumps. <code className="text-amber-400 mx-1">X-Fee-Model-Version</code>
                and <code className="text-amber-400">X-Fee-Model-Updated-At</code> response
                headers mirror the identifiers for cheap HEAD-request bump detection.
              </div>
            </Section>

            {/* Status */}
            <Section id="status" title="Status" method="GET" path="/api/v1/status">
              <p className="text-gray-400 mb-4">
                API health check + fee-model identifier. No authentication required.
                Use this for uptime monitoring or as a cheap HEAD-request probe to detect
                fee-schedule bumps without parsing a body.
              </p>
              <CodeBlock title="Response">{`{
  "success": true,
  "status": "operational",
  "version": "v1",
  "feeModel": {
    "version": "v1.0-2026-02-01",
    "updatedAt": "2026-02-01T00:00:00Z",
    "surfacedOn": ["/api/v1/arbitrage", "/api/v1/spreads", "/api/v1/funding-arb"]
  },
  "endpoints": [
    { "path": "/api/v1/funding", "method": "GET", "description": "Real-time funding rates across 32 exchanges" }
  ],
  "tiers": {
    "free": { "rateLimit": "100 req/min", "dailyLimit": "5,000 req/day" },
    "pro": { "rateLimit": "500 req/min", "dailyLimit": "unlimited" }
  },
  "documentation": "https://info-hub.io/developers/docs",
  "timestamp": 1713181800000
}`}</CodeBlock>
            </Section>

            {/* Funding Arbitrage scanner */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-green-400/70 uppercase tracking-widest font-bold">More Trading Intelligence</div>
              <div className="flex-1 h-px bg-gradient-to-r from-green-500/20 to-transparent" />
            </div>

            <Section id="funding-arb" title="Funding Arbitrage" method="GET" path="/api/v1/funding-arb">
              <p className="text-gray-400 mb-4">
                Cross-exchange funding-rate arbitrage SCANNER — returns GROSS spreads (no fees deducted).
                For the net version with feasibility grading + OI sanity + 7-day stability, see{' '}
                <a href="#arbitrage" className="text-amber-400 hover:underline">/arbitrage</a>.
              </p>
              <ParamTable params={[
                ['min_venues', 'number', '3', 'Only include symbols with N+ venues (2..40)'],
                ['min_spread', 'number', '0.01', 'Minimum 8h spread % to include'],
                ['sort', 'string', 'annualized', 'Sort: annualized | spread | venues'],
                ['limit', 'number', '100', 'Max symbols (1..500)'],
              ]} />
              <CodeBlock title="Response">{`{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "venueCount": 14,
      "min": { "exchange": "Hyperliquid", "rate8h": -0.0245, "interval": "1h", "markPrice": 81250.0, "type": "dex" },
      "max": { "exchange": "Bybit", "rate8h": 0.0567, "interval": "8h", "markPrice": 81254.5, "type": "cex" },
      "spread8h": 0.0812,
      "annualized": 88.92,
      "venues": [/* every venue */],
      "dexOnOneSide": true
    }
  ],
  "summary": { "totalSymbols": 230, "displayed": 50, "topAnnualized": 1937, "topSymbol": "AR", "medianSpread": 0.03, "dexCrossSymbols": 18 },
  "meta": { "timestamp": 1709248000, "feeModel": { /* see Fee Model section */ }, "scope": "gross" }
}`}</CodeBlock>
            </Section>

            {/* CME Basis */}
            <Section id="basis" title="CME Basis" method="GET" path="/api/v1/basis">
              <p className="text-gray-400 mb-4">
                CME front-month futures basis vs spot for BTC + ETH. Annualized cash-and-carry rate
                institutions use to size basis trades. Persistent positive basis = risk-on.
              </p>
              <CodeBlock title="Response">{`{
  "success": true,
  "data": [
    {
      "asset": "BTC",
      "spot": 81250.50,
      "cmeFront": 82100.00,
      "daysToExpiry": 28,
      "basisPct": 1.045,
      "annualizedPct": 13.63,
      "cmeSource": "CME",
      "spotSource": "coinbase"
    }
  ],
  "meta": { "timestamp": 1709248000, "fromCache": false }
}`}</CodeBlock>
            </Section>

            {/* Listing Radar */}
            <Section id="listing-radar" title="Listing Radar" method="GET" path="/api/v1/listing-radar">
              <p className="text-gray-400 mb-4">
                Real-time feed of Binance listing announcements + delistings. Listings historically
                pump 30-200% in the first 24h — this is the earliest pre-trade signal we publish.
              </p>
              <ParamTable params={[
                ['type', 'string', 'all', 'Filter: spot | perp | futures | option | delisting | other'],
                ['hot', 'number', '0', '1 = only announcements <6h old'],
                ['limit', 'number', '50', 'Max results (1..200)'],
              ]} />
            </Section>

            {/* Earnings calendar */}
            <Section id="earnings-calendar" title="Events Calendar" method="GET" path="/api/v1/earnings-calendar">
              <p className="text-gray-400 mb-4">
                Aggregated upcoming protocol events: token unlocks, TGEs, halvings, governance votes.
                Source-attributed. One unified timeline of every catalyst that historically moves price.
              </p>
            </Section>

            {/* On-chain group divider */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-purple-400/70 uppercase tracking-widest font-bold">On-chain &amp; Yield</div>
              <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent" />
            </div>

            {/* Whales */}
            <Section id="whales" title="Whale Trades" method="GET" path="/api/v1/whales">
              <p className="text-gray-400 mb-4">
                Recent on-chain DEX whale trades. Two modes:
                <code className="text-amber-400 mx-1">?address=0x...</code> for one wallet (paginated newest-first),
                or no address for the global feed across every tracked wallet.
              </p>
              <ParamTable params={[
                ['address', 'string', '', 'Lowercased EVM address or Solana base58 (optional)'],
                ['chain', 'string', 'all', 'ethereum | bsc | arbitrum | base | polygon | optimism | solana'],
                ['minValueUsd', 'number', '0', 'Only trades >= this notional (global mode only)'],
                ['limit', 'number', '50', 'Max entries (1..200)'],
              ]} />
            </Section>

            {/* Whale liquidation roulette */}
            <Section id="whale-liq" title="Whale Liquidation Roulette" method="GET" path="/api/v1/whale-liq">
              <p className="text-gray-400 mb-4">
                Hyperliquid whale positions sorted by proximity to liquidation price. Useful for
                cascade prediction and alpha generation — the closer a whale is to liq, the bigger
                the wipeout if it triggers.
              </p>
              <ParamTable params={[
                ['within', 'number', '0.20', 'Distance threshold (0..1, e.g. 0.10 = within 10% of liq)'],
                ['limit', 'number', '100', 'Max rows (1..500)'],
              ]} />
            </Section>

            {/* Smart money */}
            <Section id="smart-money-leaderboard" title="Smart Money Leaderboard" method="GET" path="/api/v1/smart-money-leaderboard">
              <p className="text-gray-400 mb-4">
                Top Hyperliquid wallets ranked by 90-day realised PnL. For each wallet: pulls
                closing-trade analytics (win rate, biggest win/loss, top symbols, days-since-last).
                Heavy first call (~5-15s) — cached 30 min after.
              </p>
            </Section>

            {/* Bridge flows */}
            <Section id="bridge-flows" title="Bridge Flows" method="GET" path="/api/v1/bridge-flows">
              <p className="text-gray-400 mb-4">
                Cross-chain bridge flow tracker (Wormhole). Volume, transfers, top assets, top corridors
                across every Wormhole-supported chain. Strong leading indicator for chain rotation.
              </p>
            </Section>

            {/* Restaking */}
            <Section id="restaking" title="Restaking Yields" method="GET" path="/api/v1/restaking">
              <p className="text-gray-400 mb-4">
                Restaking yield aggregator. Cross-protocol pools (EigenLayer + Symbiotic + Karak + LRTs)
                with APY, TVL, reward composition. Source: DeFi Llama yields.
              </p>
            </Section>

            {/* Tools */}
            <div className="flex items-center gap-3 mb-8 mt-4">
              <div className="text-[10px] text-cyan-400/70 uppercase tracking-widest font-bold">Tools</div>
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
            </div>

            <Section id="backtest" title="Backtest" method="POST" path="/api/v1/backtest">
              <p className="text-gray-400 mb-4">
                Run a strategy backtest on historical data. Two strategies:
                <strong className="text-white"> dca</strong> (dollar-cost average accumulation) and
                <strong className="text-white"> funding-carry</strong> (collect funding spread between
                cheap-and-expensive venues). Pure historical simulation — no fees, slippage, or
                execution lag modelled.
              </p>
              <CodeBlock title="Request body (DCA)">{`{
  "strategy": "dca",
  "config": {
    "asset": "bitcoin",
    "amountUsd": 100,
    "intervalDays": 7,
    "lookbackDays": 90
  }
}`}</CodeBlock>
              <CodeBlock title="Request body (funding-carry)">{`{
  "strategy": "funding-carry",
  "config": {
    "notionalUsd": 10000,
    "lookbackDays": 30,
    "symbol": "BTC"
  }
}`}</CodeBlock>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-[13px] text-gray-400">
                Response returns daily portfolio-value series, max drawdown, and Sharpe-ish ratio.
                <code className="text-amber-400 mx-1">lookbackDays</code> clamped to 365.
              </div>
            </Section>

            {/* Error Codes */}
            <Section id="error-codes" title="Error Codes">
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/[0.06] text-[11px] uppercase tracking-wider">
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-left py-2 pr-4 font-medium">Code</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {([
                      ['200', 'OK', 'Request succeeded'],
                      ['400', 'Bad Request', 'Invalid or missing parameters'],
                      ['401', 'Unauthorized', 'Missing or invalid API key'],
                      ['429', 'Too Many Requests', 'Rate limit exceeded, check Retry-After header'],
                      ['500', 'Internal Error', 'Something went wrong on our end'],
                      ['502', 'Bad Gateway', 'Upstream exchange returned an error'],
                      ['503', 'Unavailable', 'Service temporarily down for maintenance'],
                    ] as const).map(([code, name, desc]) => (
                      <tr key={code} className="border-b border-white/[0.03]">
                        <td className="py-2.5 pr-4">
                          <code className={`text-xs font-mono font-bold ${
                            code === '200' ? 'text-green-400' :
                            code.startsWith('4') ? 'text-amber-400' : 'text-red-400'
                          }`}>{code}</code>
                        </td>
                        <td className="py-2.5 pr-4 text-white text-[13px] font-medium">{name}</td>
                        <td className="py-2.5 text-gray-400 text-[13px]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CodeBlock title="Error response format">{`{
  "success": false,
  "error": "Rate limit exceeded. Upgrade to Pro for higher limits."
}`}</CodeBlock>
            </Section>

          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
