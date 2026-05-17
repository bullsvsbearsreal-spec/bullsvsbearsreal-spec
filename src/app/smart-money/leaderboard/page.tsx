'use client';

/**
 * /smart-money/leaderboard — Top traders ranked by realized PnL.
 *
 * The "Nansen for Hyperliquid" feature. Pulls the HL leaderboard, sums
 * each top wallet's closing-trade PnL across the last 90 days, ranks.
 * Click into any wallet for full position + trade detail at /trader/[address].
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Trophy, RefreshCw, ExternalLink, AlertCircle, ArrowLeft } from 'lucide-react';

interface SmartMoneyEntry {
  rank: number;
  address: string;
  label: string;
  accountValueUsd: number;
  allTimePnlUsd: number;
  allTimeRoiPct: number;
  realised90dUsd: number;
  realised30dUsd: number;
  closingTrades90d: number;
  winRatePct: number | null;
  biggestWinUsd: number;
  biggestLossUsd: number;
  topSymbols: string[];
  lastTradeTs: number | null;
  daysSinceLastTrade: number | null;
}

interface ApiResponse {
  ts: number;
  entries: SmartMoneyEntry[];
  scanned: number;
  lookbackDays: number;
}

const fmtUsd = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};
const fmtUsdSign = (n: number) => (n >= 0 ? '+' : '') + fmtUsd(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const truncAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function activityBadge(days: number | null): string {
  if (days == null) return 'inactive';
  if (days < 1) return '🟢 today';
  if (days < 3) return '🟢 active';
  if (days < 7) return '🟡 this week';
  if (days < 30) return '🟡 this month';
  return '⚪ stale';
}

export default function SmartMoneyLeaderboardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topN, setTopN] = useState(50);
  const [lookback, setLookback] = useState(90);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/smart-money/leaderboard?topN=${topN}&lookbackDays=${lookback}`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [topN, lookback]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <Link href="/smart-money" className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> back to smart-money overview
        </Link>
        <PageHero
          icon={Trophy}
          eyebrow="Live · HL realized PnL"
          title="Top trader"
          accentNoun="leaderboard"
          accent="orange"
          description={<>Top Hyperliquid wallets ranked by REALIZED PnL — closing trades only, last {lookback} days. Hyperliquid is the rare venue where every fill is publicly indexable, so we get Nansen-tier data for free. Click any row for full position + trade history.</>}
          actions={
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
            </button>
          }
        />

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Top:</span>
          {[20, 50, 100].map(n => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`text-[11px] px-2 py-1 rounded font-medium ${
                topN === n ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium ml-2">Lookback:</span>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setLookback(d)}
              className={`text-[11px] px-2 py-1 rounded font-medium ${
                lookback === d ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4 inline-flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            Computing leaderboard… this can take 5–15s on a cold cache (we&rsquo;re fetching every wallet&rsquo;s 90-day fill history live).
          </div>
        )}

        {data && data.entries.length > 0 && (
          <div className="card-premium overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-2 py-2 font-medium">Wallet</th>
                  <th className="text-right px-2 py-2 font-medium">Realised {lookback}d</th>
                  <th className="text-right px-2 py-2 font-medium">Realised 30d</th>
                  <th className="text-right px-2 py-2 font-medium">Win rate</th>
                  <th className="text-right px-2 py-2 font-medium">Closes</th>
                  <th className="text-right px-2 py-2 font-medium">Biggest W</th>
                  <th className="text-right px-2 py-2 font-medium">Biggest L</th>
                  <th className="text-left px-2 py-2 font-medium">Top symbols</th>
                  <th className="text-right px-2 py-2 font-medium">Last seen</th>
                  <th className="text-right px-3 py-2 font-medium">Account NAV</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => (
                  <tr key={e.address} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-neutral-500 tabular-nums">{e.rank}</td>
                    <td className="px-2 py-2">
                      <Link href={`/trader/${e.address}`} className="text-white hover:text-hub-yellow font-mono inline-flex items-center gap-1">
                        {e.label === e.address || e.label.startsWith('0x') ? truncAddr(e.address) : e.label}
                        <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                      </Link>
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums font-bold ${e.realised90dUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtUsdSign(e.realised90dUsd)}
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${e.realised30dUsd >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                      {fmtUsdSign(e.realised30dUsd)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-300">
                      {e.winRatePct == null ? '—' : fmtPct(e.winRatePct)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-400">{e.closingTrades90d}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-400/70">{fmtUsd(e.biggestWinUsd)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-400/70">{fmtUsd(e.biggestLossUsd)}</td>
                    <td className="px-2 py-2 text-[11px] text-neutral-400">{e.topSymbols.slice(0, 3).join(' · ') || '—'}</td>
                    <td className="px-2 py-2 text-right text-[11px] text-neutral-500 whitespace-nowrap">
                      {activityBadge(e.daysSinceLastTrade)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{fmtUsd(e.accountValueUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.entries.length === 0 && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No active wallets in lookback window.
          </div>
        )}

        {data && (
          <div className="text-center mt-4 text-[10px] text-neutral-600">
            Last refresh: {new Date(data.ts).toLocaleTimeString()} · scanned {data.scanned} top wallets · cached 30 min
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
