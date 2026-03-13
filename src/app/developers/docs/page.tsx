'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="mb-4">
      {title && <div className="text-xs text-gray-500 mb-1">{title}</div>}
      <pre className="bg-black/50 border border-gray-800 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function ParamTable({ params }: { params: Array<[string, string, string, string]> }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            <th className="text-left py-2 pr-4">Param</th>
            <th className="text-left py-2 pr-4">Type</th>
            <th className="text-left py-2 pr-4">Default</th>
            <th className="text-left py-2">Description</th>
          </tr>
        </thead>
        <tbody className="text-gray-300">
          {params.map(([name, type, def, desc]) => (
            <tr key={name} className="border-b border-gray-800/50">
              <td className="py-2 pr-4"><code className="text-amber-400">{name}</code></td>
              <td className="py-2 pr-4 text-gray-500">{type}</td>
              <td className="py-2 pr-4 text-gray-500">{def}</td>
              <td className="py-2 text-gray-400">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/developers" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-white">API</span>{' '}
          <span className="text-amber-400">Documentation</span>
        </h1>
        <p className="text-gray-400 mb-8">InfoHub Public API v1 — real-time derivatives intelligence</p>

        {/* TOC */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-10">
          <div className="text-sm text-gray-400 space-y-1">
            {['Authentication', 'Rate Limits', 'Funding Rates', 'Funding History', 'Arbitrage', 'Open Interest', 'Exchanges', 'Error Codes'].map(s => (
              <a key={s} href={`#${s.toLowerCase().replace(/\s+/g, '-')}`} className="block hover:text-amber-400 transition-colors">
                {s}
              </a>
            ))}
          </div>
        </div>

        <Section id="authentication" title="Authentication">
          <p className="text-gray-400 mb-4">
            All endpoints (except <code className="text-amber-400">/api/v1/status</code>) require an API key
            passed via the <code className="text-amber-400">Authorization</code> header.
          </p>
          <CodeBlock title="Header format">{`Authorization: Bearer ih_your_api_key_here`}</CodeBlock>
          <p className="text-gray-400 text-sm">
            Generate keys at <Link href="/developers" className="text-amber-400 hover:underline">/developers</Link>.
            Keys start with <code className="text-amber-400">ih_</code>.
          </p>
        </Section>

        <Section id="rate-limits" title="Rate Limits">
          <p className="text-gray-400 mb-4">Rate limit info is included in every response header:</p>
          <CodeBlock>{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1709248060`}</CodeBlock>
          <div className="text-gray-400 text-sm space-y-1 mb-4">
            <p><strong className="text-white">Free:</strong> 100 req/min, 5,000 req/day</p>
            <p><strong className="text-white">Pro:</strong> 500 req/min, unlimited daily</p>
          </div>
          <p className="text-gray-500 text-sm">When rate limited, you receive a 429 with <code className="text-amber-400">Retry-After</code> header.</p>
        </Section>

        <Section id="funding-rates" title="Funding Rates">
          <p className="text-gray-400 mb-2"><code className="text-green-400">GET</code> <code className="text-amber-400">/api/v1/funding</code></p>
          <p className="text-gray-400 mb-4">Real-time funding rates across 30 exchanges. Rates are in native interval percentage.</p>
          <ParamTable params={[
            ['symbols', 'string', '—', 'Comma-separated symbols (e.g. BTC,ETH,SOL)'],
            ['exchanges', 'string', '—', 'Comma-separated exchanges (e.g. binance,bybit)'],
            ['assetClass', 'string', 'crypto', 'crypto | stocks | forex | commodities | all'],
          ]} />
          <CodeBlock title="Response">{`{
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
  "meta": { "timestamp": 1709248000, "exchanges": 24, "pairs": 6466 }
}`}</CodeBlock>
        </Section>

        <Section id="funding-history" title="Funding History">
          <p className="text-gray-400 mb-2"><code className="text-green-400">GET</code> <code className="text-amber-400">/api/v1/funding/history</code></p>
          <p className="text-gray-400 mb-4">Historical funding rate snapshots from database (10-min resolution, up to 7 days).</p>
          <ParamTable params={[
            ['symbols', 'string', '(required)', 'Comma-separated symbols (max 20)'],
            ['days', 'number', '7', 'Lookback period (1-14)'],
          ]} />
        </Section>

        <Section id="arbitrage" title="Arbitrage">
          <p className="text-gray-400 mb-2"><code className="text-green-400">GET</code> <code className="text-amber-400">/api/v1/arbitrage</code></p>
          <p className="text-gray-400 mb-4">
            Funding rate arbitrage opportunities with feasibility grades, PnL projections, and OI data.
            Short the high-rate exchange, long the low-rate exchange.
          </p>
          <ParamTable params={[
            ['minSpread', 'number', '0', 'Minimum 8h spread % (e.g. 0.05)'],
            ['minOI', 'number', '0', 'Minimum OI in USD on smaller side'],
            ['grade', 'string', '—', 'Filter by grade: A,B,C,D (comma-separated)'],
            ['symbols', 'string', '—', 'Comma-separated symbols'],
            ['limit', 'number', '100', 'Max results (1-500)'],
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
      "fees": { "roundTrip": 0.2200, ... },
      "oi": { "short": 500000, "long": 120000, "total": 620000, "minSide": 120000 },
      "grade": "C",
      "stability": "volatile",
      "exchangeCount": 5,
      "allExchanges": [
        { "exchange": "Kraken", "rate8h": 0.5032, "type": "cex" },
        { "exchange": "Bybit", "rate8h": 0.2100, "type": "cex" },
        ...
      ]
    }
  ],
  "meta": { "totalPairs": 657, "filtered": 50, "grades": { "A": 0, "B": 1, "C": 120, "D": 536 } }
}`}</CodeBlock>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-sm text-gray-400">
            <strong className="text-white">Grades explained:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span className="text-green-400">A</span> — High OI, realistic spread, stable history</li>
              <li><span className="text-blue-400">B</span> — Good OI, moderate spread, mostly stable</li>
              <li><span className="text-amber-400">C</span> — Lower OI or volatile, still actionable</li>
              <li><span className="text-red-400">D</span> — Fees exceed spread or very low OI</li>
            </ul>
          </div>
        </Section>

        <Section id="open-interest" title="Open Interest">
          <p className="text-gray-400 mb-2"><code className="text-green-400">GET</code> <code className="text-amber-400">/api/v1/openinterest</code></p>
          <p className="text-gray-400 mb-4">Open interest data across exchanges in USD.</p>
          <ParamTable params={[
            ['symbols', 'string', '—', 'Comma-separated symbols'],
            ['exchanges', 'string', '—', 'Comma-separated exchanges'],
          ]} />
        </Section>

        <Section id="exchanges" title="Exchanges">
          <p className="text-gray-400 mb-2"><code className="text-green-400">GET</code> <code className="text-amber-400">/api/v1/exchanges</code></p>
          <p className="text-gray-400 mb-4">
            Metadata for all 24 supported exchanges: fees, funding intervals, and trade URL patterns.
          </p>
        </Section>

        <Section id="error-codes" title="Error Codes">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {[
                  ['400', 'Bad request — invalid parameters'],
                  ['401', 'Unauthorized — missing or invalid API key'],
                  ['429', 'Rate limited — check Retry-After header'],
                  ['500', 'Internal server error'],
                  ['502', 'Upstream exchange error'],
                  ['503', 'Service temporarily unavailable'],
                ].map(([code, desc]) => (
                  <tr key={code} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4"><code className="text-red-400">{code}</code></td>
                    <td className="py-2 text-gray-400">{desc}</td>
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
      <Footer />
    </div>
  );
}
