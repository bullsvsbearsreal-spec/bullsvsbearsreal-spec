'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Copy, Check, ExternalLink, Database, Globe, Zap, Clock, Shield } from 'lucide-react';
import { ALL_EXCHANGES, CEX_EXCHANGES, DEX_EXCHANGES } from '@/lib/constants';

interface EndpointProps {
  method: string;
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  response: string;
  example: string;
  exchanges?: string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
    </button>
  );
}

function EndpointSection({ method, path, description, params, response, example, exchanges }: EndpointProps) {
  const [expanded, setExpanded] = useState(false);
  const baseUrl = 'https://info-hub.io';
  const curlCmd = `curl "${baseUrl}${path}"`;
  const jsExample = `const res = await fetch("${baseUrl}${path}");
const data = await res.json();
console.log(data.data.length, "entries");`;
  const pyExample = `import requests
resp = requests.get("${baseUrl}${path}")
data = resp.json()
print(len(data["data"]), "entries")`;

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 uppercase tracking-wider">
          {method}
        </span>
        <code className="text-white font-mono text-sm flex-1">{path}</code>
        <span className="text-neutral-500 text-xs hidden sm:inline">{description}</span>
        <span className="text-neutral-600 text-lg">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-5 py-4 space-y-4">
          <p className="text-neutral-400 text-sm">{description}</p>

          {/* Parameters */}
          {params && params.length > 0 && (
            <div>
              <h4 className="text-neutral-300 text-xs font-semibold uppercase tracking-wider mb-2">Parameters</h4>
              <div className="space-y-1">
                {params.map(p => (
                  <div key={p.name} className="flex items-start gap-3 text-xs">
                    <code className="text-hub-yellow font-mono bg-hub-yellow/5 px-1.5 py-0.5 rounded">{p.name}</code>
                    <span className="text-neutral-600">{p.type}</span>
                    <span className={p.required ? 'text-red-400' : 'text-neutral-700'}>{p.required ? 'required' : 'optional'}</span>
                    <span className="text-neutral-400">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Schema */}
          <div>
            <h4 className="text-neutral-300 text-xs font-semibold uppercase tracking-wider mb-2">Response Schema</h4>
            <pre className="bg-black/50 border border-white/[0.06] rounded-lg p-3 text-xs text-neutral-300 font-mono overflow-x-auto">
              {response}
            </pre>
          </div>

          {/* Code Examples */}
          <div>
            <h4 className="text-neutral-300 text-xs font-semibold uppercase tracking-wider mb-2">Examples</h4>
            <div className="space-y-2">
              {/* cURL */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-600 text-[10px] font-mono">cURL</span>
                  <CopyButton text={curlCmd} />
                </div>
                <pre className="bg-black/50 border border-white/[0.06] rounded-lg p-2 text-xs text-green-400 font-mono overflow-x-auto">
                  {curlCmd}
                </pre>
              </div>
              {/* JavaScript */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-600 text-[10px] font-mono">JavaScript</span>
                  <CopyButton text={jsExample} />
                </div>
                <pre className="bg-black/50 border border-white/[0.06] rounded-lg p-2 text-xs text-blue-400 font-mono overflow-x-auto">
                  {jsExample}
                </pre>
              </div>
              {/* Python */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-600 text-[10px] font-mono">Python</span>
                  <CopyButton text={pyExample} />
                </div>
                <pre className="bg-black/50 border border-white/[0.06] rounded-lg p-2 text-xs text-yellow-400 font-mono overflow-x-auto">
                  {pyExample}
                </pre>
              </div>
            </div>
          </div>

          {/* Example Response */}
          <div>
            <h4 className="text-neutral-300 text-xs font-semibold uppercase tracking-wider mb-2">Example Response (truncated)</h4>
            <pre className="bg-black/50 border border-white/[0.06] rounded-lg p-3 text-[11px] text-neutral-400 font-mono overflow-x-auto max-h-60 overflow-y-auto">
              {example}
            </pre>
          </div>

          {/* Exchanges */}
          {exchanges && (
            <div>
              <h4 className="text-neutral-300 text-xs font-semibold uppercase tracking-wider mb-2">Exchanges ({exchanges.length})</h4>
              <div className="flex flex-wrap gap-1.5">
                {exchanges.map(ex => (
                  <span key={ex} className="px-2 py-1 rounded-md bg-white/[0.04] text-neutral-400 text-[11px] font-mono">
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FUNDING_EXCHANGES = [...ALL_EXCHANGES];

const OI_EXCHANGES = [...ALL_EXCHANGES];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="heading-page mb-2">InfoHub Public API</h1>
          <p className="text-neutral-400 text-sm mb-4">
            Real-time crypto derivatives data. No API key required. 8 endpoints, {ALL_EXCHANGES.length} exchanges.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-xs font-medium">{ALL_EXCHANGES.length} Exchanges ({CEX_EXCHANGES.size} CEX + {DEX_EXCHANGES.size} DEX)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/5 border border-purple-500/10 rounded-lg">
              <Globe className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 text-xs font-medium">Edge Runtime (Dubai)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 border border-green-500/10 rounded-lg">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-xs font-medium">~10s refresh</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-hub-yellow/5 border border-hub-yellow/10 rounded-lg">
              <Shield className="w-4 h-4 text-hub-yellow" />
              <span className="text-hub-yellow text-xs font-medium">No auth required</span>
            </div>
          </div>
        </div>

        {/* Base URL */}
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-neutral-500 text-xs">Base URL</span>
              <div className="text-white font-mono text-sm">https://info-hub.io</div>
            </div>
            <CopyButton text="https://info-hub.io" />
          </div>
        </div>

        {/* Fair Use */}
        <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4 mb-6">
          <h3 className="text-hub-yellow font-semibold text-xs uppercase tracking-wider mb-1">Fair Use Policy</h3>
          <p className="text-neutral-400 text-xs leading-relaxed">
            No authentication or rate limits are currently enforced. Please limit requests to 1 per 10 seconds per endpoint.
            Data refreshes every ~10 seconds server-side. Excessive use may result in temporary IP blocking.
            All rates are normalized to 8-hour basis. Anomalous rates (&gt;5% per 8h) are automatically capped.
          </p>
        </div>

        {/* Endpoints */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold text-lg mb-3">Endpoints</h2>

          <EndpointSection
            method="GET"
            path="/api/funding?assetClass=crypto"
            description={`Real-time funding rates across ${ALL_EXCHANGES.length} exchanges`}
            params={[
              { name: 'assetClass', type: 'string', required: false, description: 'crypto (default) | stocks | forex | commodities | all' },
            ]}
            response={`{
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "fundingRate": 0.000089,    // 8h rate as decimal
      "markPrice": 67865.77,
      "indexPrice": 67899.01,
      "nextFundingTime": 1770912000000,
      "type": "cex"
    }
  ],
  "health": [
    { "exchange": "Binance", "status": "ok", "count": 257, "latencyMs": 412 }
  ],
  "meta": {
    "totalExchanges": 29,
    "activeExchanges": 29,
    "totalEntries": 8200,
    "assetClass": "crypto",
    "timestamp": 1770901234567,
    "normalization": {
      "basis": "8h",
      "note": "All rates normalized to 8-hour percentage..."
    }
  }
}`}
            example={`{
  "data": [
    { "symbol": "BTC", "exchange": "Binance", "fundingRate": 0.000089, "markPrice": 67865.77, ... },
    { "symbol": "ETH", "exchange": "Binance", "fundingRate": -0.000017, "markPrice": 1981.50, ... },
    ...6200+ more entries
  ],
  "meta": { "totalEntries": 6285, "activeExchanges": 24 }
}`}
            exchanges={FUNDING_EXCHANGES}
          />

          <EndpointSection
            method="GET"
            path="/api/openinterest"
            description="Open interest data across 29 exchanges"
            response={`{
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "openInterest": 123456.78,     // coins
      "openInterestValue": 8234567890, // USD
      "price": 67865.77
    }
  ],
  "health": [...],
  "meta": {
    "totalExchanges": 17,
    "activeExchanges": 17,
    "totalEntries": 2801,
    "timestamp": 1770901234567
  }
}`}
            example={`{
  "data": [
    { "symbol": "BTC", "exchange": "Binance", "openInterest": 123456.78, "openInterestValue": 8234567890, ... },
    ...2800+ more entries
  ],
  "meta": { "totalEntries": 2800, "activeExchanges": 29 }
}`}
            exchanges={OI_EXCHANGES}
          />

          <EndpointSection
            method="GET"
            path="/api/tickers"
            description="Price tickers with 24h change and volume"
            response={`{
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "price": 67865.77,
      "change24h": 2.34,
      "volume24h": 1234567890
    }
  ],
  "meta": { ... }
}`}
            example={`{ "data": [ { "symbol": "BTC", "exchange": "Binance", "price": 67865.77, ... }, ... ] }`}
          />

          <EndpointSection
            method="GET"
            path="/api/longshort"
            description="Long/short ratio data for top traders"
            response={`{
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "longRatio": 0.55,
      "shortRatio": 0.45,
      "longShortRatio": 1.22
    }
  ],
  "meta": { ... }
}`}
            example={`{ "data": [ { "symbol": "BTC", "exchange": "Binance", "longRatio": 0.55, ... }, ... ] }`}
          />

          <EndpointSection
            method="GET"
            path="/api/liquidations"
            description="Real-time liquidation data across exchanges"
            response={`{
  "data": [
    {
      "symbol": "BTC",
      "exchange": "Binance",
      "side": "long",
      "quantity": 1.234,
      "price": 67800.50,
      "usdValue": 83671.42,
      "timestamp": 1770901234567
    }
  ],
  "meta": { "totalEntries": 450 }
}`}
            example={`{ "data": [ { "symbol": "BTC", "exchange": "Binance", "side": "long", "usdValue": 83671.42, ... }, ... ] }`}
          />

          <EndpointSection
            method="GET"
            path="/api/fear-greed"
            description="Crypto Fear & Greed Index (current value)"
            response={`{
  "value": 72,
  "classification": "Greed",
  "timestamp": 1770901234567
}`}
            example={`{ "value": 72, "classification": "Greed", "timestamp": 1770901234567 }`}
          />

          <EndpointSection
            method="GET"
            path="/api/fear-greed?history=true&limit=30"
            description="Fear & Greed historical data"
            params={[
              { name: 'history', type: 'string', required: true, description: 'Set to "true" to get historical data' },
              { name: 'limit', type: 'number', required: false, description: '7 | 30 | 90 | 365 (default: 30)' },
            ]}
            response={`{
  "current": { "value": 72, "classification": "Greed", "timestamp": 1770901234567 },
  "history": [
    { "value": 72, "classification": "Greed", "timestamp": 1770901234567 },
    { "value": 68, "classification": "Greed", "timestamp": 1770814834567 },
    ...
  ]
}`}
            example={`{ "current": { "value": 72, ... }, "history": [ { "value": 72, ... }, ... 30 entries ] }`}
          />

          <EndpointSection
            method="GET"
            path="/api/wallet?address=0x...&chain=eth"
            description="Wallet balance and transactions"
            params={[
              { name: 'address', type: 'string', required: true, description: 'Wallet address (ETH, BTC, or SOL)' },
              { name: 'chain', type: 'string', required: true, description: 'eth | btc | sol' },
            ]}
            response={`{
  "chain": "eth",
  "address": "0xd8dA...",
  "balance": "1234.5678",
  "balanceRaw": 1234.5678,
  "transactions": [
    { "hash": "0x...", "from": "0x...", "to": "0x...", "value": "1.5", "timestamp": 1770901234567, "direction": "in" }
  ],
  "tokens": [
    { "symbol": "USDC", "name": "USD Coin", "balance": 50000, "decimals": 6 }
  ]
}`}
            example={`{ "chain": "eth", "balance": "1234.5678", "transactions": [...], "tokens": [...] }`}
          />
        </div>

        {/* Quick Reference */}
        <div className="mt-8 bg-hub-darker border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-hub-yellow" />
            Quick Reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="text-neutral-400 font-medium mb-2">Data Refresh Rates</h4>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-neutral-500">Funding Rates</span><span className="text-white font-mono">~30s</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Open Interest</span><span className="text-white font-mono">~30s</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Tickers</span><span className="text-white font-mono">~10s</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Liquidations</span><span className="text-white font-mono">~30s</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Fear & Greed</span><span className="text-white font-mono">~30min</span></div>
              </div>
            </div>
            <div>
              <h4 className="text-neutral-400 font-medium mb-2">Normalization Notes</h4>
              <div className="space-y-1 text-neutral-500">
                <p>Funding rates normalized to 8h basis</p>
                <p>Rates &gt;5% per 8h are capped</p>
                <p>OI values in USD</p>
                <p>Symbols stripped of USDT/USD suffixes</p>
                <p>1000-prefix tokens (1000PEPE) use base symbol</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-neutral-700 text-xs">
            Questions? Reach out on <a href="https://x.com/info_hub69" target="_blank" rel="noopener noreferrer" className="text-hub-yellow/60 hover:text-hub-yellow transition-colors">X</a> or <a href="mailto:contact@info-hub.io" className="text-hub-yellow/60 hover:text-hub-yellow transition-colors">email us</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
