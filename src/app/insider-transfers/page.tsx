'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Eye, RefreshCw, ExternalLink, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, Info,
} from 'lucide-react';
import { INSIDER_WALLETS, explorerUrl, arkhamUrl } from '@/lib/insider-wallets';

interface Transfer {
  walletLabel: string;
  walletAddress: string;
  chain: string;
  project: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  contract: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  amount: number;
  isOutflow: boolean;
}

interface ApiResponse {
  walletsTracked: number;
  transfers: Transfer[];
  hasApiKey: boolean;
  ts: number;
}

const TYPE_TONE: Record<string, string> = {
  'team': 'bg-amber-500/10 text-amber-400 border-amber-400/20',
  'foundation': 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
  'treasury': 'bg-cyan-500/10 text-cyan-400 border-cyan-400/20',
  'investor': 'bg-violet-500/10 text-violet-400 border-violet-400/20',
  'market-maker': 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  'mint-authority': 'bg-pink-500/10 text-pink-400 border-pink-400/20',
  'reserves': 'bg-rose-500/10 text-rose-400 border-rose-400/20',
};

function fmtAmount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function shortAddr(a: string): string {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

export default function InsiderTransfersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'feed' | 'directory'>('feed');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/insider-transfers', { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const directorySorted = useMemo(() => {
    return [...INSIDER_WALLETS].sort((a, b) => a.project.localeCompare(b.project));
  }, []);

  return (
    <>
      <Header />
      <main className="max-w-[1300px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Eye className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Insider Watch</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {INSIDER_WALLETS.length} wallets · {data?.transfers.length ?? 0} recent transfers
            </span>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Curated directory of foundations, team wallets, market makers, and
            high-signal whale addresses worth watching. Live transfer feed when
            an Etherscan API key is configured.
          </p>
        </div>

        {/* No-API banner */}
        {data && !data.hasApiKey && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.04] text-amber-200 flex items-start gap-3 flex-wrap">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="text-xs flex-1 min-w-0">
              <div className="font-bold mb-1">Live transfer feed disabled</div>
              <div className="text-amber-200/80 leading-relaxed">
                Set <code className="bg-black/40 px-1 py-0.5 rounded font-mono">ETHERSCAN_API_KEY</code> in
                production env to enable the live transfer feed (free tier at{' '}
                <a href="https://etherscan.io/myapikey" target="_blank" rel="noopener" className="underline hover:text-amber-100">etherscan.io/myapikey</a>{' '}
                — same key works for ETH, Arbitrum, Base, BSC, Avalanche).
                Until then, the directory below is browsable with deep links.
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 mb-4 w-fit">
          {([
            ['feed', 'Recent transfers'],
            ['directory', 'Directory'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === k ? 'bg-amber-400 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {/* Feed tab */}
        {tab === 'feed' && data?.hasApiKey && data.transfers.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[100px,1fr,90px,110px,140px,100px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>When</div>
              <div>Wallet</div>
              <div className="text-right">Direction</div>
              <div className="text-right">Amount</div>
              <div>Token</div>
              <div className="text-right">Counterparty</div>
              <div></div>
            </div>
            {data.transfers.slice(0, 60).map(t => (
              <div
                key={t.txHash + t.contract}
                className={`grid grid-cols-[100px,1fr,90px,110px,140px,100px,40px] gap-3 px-3 py-2 items-center rounded ${
                  t.isOutflow ? 'hover:bg-rose-500/[0.03]' : 'hover:bg-emerald-500/[0.03]'
                }`}
              >
                <div className="text-[10px] text-neutral-500 font-mono">
                  {timeAgo(t.timestamp)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-white font-bold truncate">{t.walletLabel}</div>
                  <div className="text-[10px] text-neutral-600 font-mono">{t.project} · {t.chain}</div>
                </div>
                <div className={`text-right text-xs font-mono inline-flex items-center justify-end gap-1 ${t.isOutflow ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {t.isOutflow ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                  {t.isOutflow ? 'OUT' : 'IN'}
                </div>
                <div className="text-right font-mono text-xs text-white font-semibold">
                  {fmtAmount(t.amount)}
                </div>
                <div className="text-xs text-neutral-300 truncate">
                  <span className="font-bold">{t.tokenSymbol}</span>
                  <span className="text-neutral-600 ml-1.5">{t.tokenName}</span>
                </div>
                <div className="text-right font-mono text-[10px] text-neutral-500 truncate">
                  {shortAddr(t.isOutflow ? t.to : t.from)}
                </div>
                <a
                  href={`https://etherscan.io/tx/${t.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-right text-neutral-500 hover:text-hub-yellow"
                  aria-label="Open transaction on Etherscan"
                >
                  <ExternalLink className="w-3 h-3 inline-block" />
                </a>
              </div>
            ))}
          </div>
        )}

        {tab === 'feed' && (!data?.hasApiKey || (data?.transfers ?? []).length === 0) && data && (
          <div className="card-premium p-12 text-center">
            <Info className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-400 mb-1">
              {!data.hasApiKey ? 'Live feed needs an API key' : 'No recent transfers'}
            </p>
            <p className="text-[11px] text-neutral-600">
              Switch to the Directory tab to browse all tracked wallets.
            </p>
          </div>
        )}

        {/* Directory tab */}
        {tab === 'directory' && (
          <div className="space-y-2">
            {directorySorted.map(w => (
              <div
                key={w.address + w.chain}
                className="card-premium p-3 flex items-start gap-3 hover:border-white/[0.15] transition-all flex-wrap"
              >
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm text-white font-bold">{w.label}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border ${TYPE_TONE[w.type] ?? TYPE_TONE.investor}`}>
                      {w.type}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">{w.project}</span>
                    <span className="text-[10px] text-neutral-600 font-mono uppercase">{w.chain}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-1.5 leading-relaxed">{w.notes}</p>
                  <div className="text-[10px] text-neutral-700 font-mono break-all">{w.address}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={explorerUrl(w)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-hub-yellow hover:border-hub-yellow/30 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> Explorer
                  </a>
                  <a
                    href={arkhamUrl(w)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-hub-yellow hover:border-hub-yellow/30 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> Arkham
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to use:</strong> watch foundations
          and team wallets for outflows to exchanges (often precede sells), watch
          market-makers for inventory shifts, watch reserves wallets for unusual
          flows. Set <code className="bg-black/40 px-1 py-0.5 rounded">ETHERSCAN_API_KEY</code>
          {' '}to enable the live transfer feed. Spotted a wallet that should be
          tracked? <a href="https://x.com/info_hub69" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">DM @info_hub69</a>.
        </div>
      </main>
      <Footer />
    </>
  );
}
