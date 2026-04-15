'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import CoinSearch from '@/components/CoinSearch';
import { useDashboard } from './DashboardContext';

const QUICK_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'PEPE'] as const;
const TIMEFRAMES = [
  { label: '1H', value: 60 },
  { label: '4H', value: 240 },
  { label: '1D', value: 1440 },
  { label: '7D', value: 10080 },
] as const;

interface HeaderStats {
  btcPrice: number | null;
  btcChange: number | null;
  fearGreed: number | null;
  marketCapChange: number | null;
  totalMarketCap: number | null;
  btcDominance: number | null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHeader({ userName }: { userName: string }) {
  const [stats, setStats] = useState<HeaderStats>({
    btcPrice: null, btcChange: null, fearGreed: null, marketCapChange: null,
    totalMarketCap: null, btcDominance: null,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [tickerRes, fgRes, globalRes] = await Promise.allSettled([
        fetch('/api/tickers', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
        fetch('/api/fear-greed', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
        fetch('/api/global-stats', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
      ]);

      if (!mounted) return;

      const tickerData = tickerRes.status === 'fulfilled' ? tickerRes.value : null;
      const tickers = Array.isArray(tickerData) ? tickerData : tickerData?.data || [];
      const btc = Array.isArray(tickers) ? tickers.find((t: any) => t.symbol === 'BTC' || t.symbol === 'BTCUSDT') : null;

      const fgData = fgRes.status === 'fulfilled' ? fgRes.value : null;
      const globalData = globalRes.status === 'fulfilled' ? globalRes.value : null;

      setStats({
        btcPrice: btc?.price || btc?.lastPrice || null,
        btcChange: btc?.priceChangePercent ?? btc?.change24h ?? null,
        fearGreed: fgData?.value ?? null,
        marketCapChange: globalData?.market_cap_change_percentage_24h_usd ?? null,
        totalMarketCap: globalData?.total_market_cap?.usd ?? null,
        btcDominance: globalData?.market_cap_percentage?.btc ?? null,
      });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const fmtPrice = (p: number) => '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtCap = (n: number) => n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : `$${(n / 1e9).toFixed(0)}B`;

  return (
    <div className="mb-5">
      <h1 className="text-xl sm:text-2xl font-bold text-white">
        {getGreeting()}, <span className="text-gradient">{userName}</span>
      </h1>

      {/* Quick stats bar */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {stats.btcPrice !== null && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500">BTC</span>
            <span className="text-white font-medium tabular-nums">{fmtPrice(stats.btcPrice)}</span>
            {stats.btcChange !== null && (
              <span className={`flex items-center gap-0.5 ${stats.btcChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.btcChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {stats.btcChange >= 0 ? '+' : ''}{stats.btcChange.toFixed(1)}%
              </span>
            )}
          </div>
        )}
        {stats.fearGreed !== null && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500">Fear & Greed</span>
            <span className={`font-medium tabular-nums ${stats.fearGreed <= 25 ? 'text-red-400' : stats.fearGreed <= 45 ? 'text-orange-400' : stats.fearGreed <= 55 ? 'text-yellow-400' : stats.fearGreed <= 75 ? 'text-green-400' : 'text-emerald-400'}`}>
              {stats.fearGreed}
            </span>
          </div>
        )}
        {stats.totalMarketCap !== null && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500">MCap</span>
            <span className="text-white font-medium tabular-nums">{fmtCap(stats.totalMarketCap)}</span>
            {stats.marketCapChange !== null && (
              <span className={`${stats.marketCapChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.marketCapChange >= 0 ? '+' : ''}{stats.marketCapChange.toFixed(1)}%
              </span>
            )}
          </div>
        )}
        {stats.btcDominance !== null && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500">BTC.D</span>
            <span className="text-white font-medium tabular-nums">{stats.btcDominance.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Global symbol & timeframe sync bar */}
      <GlobalSymbolBar />
    </div>
  );
}

/* ─── Global Symbol Bar ──────────────────────────────────────────────── */

function GlobalSymbolBar() {
  const { state, dispatch } = useDashboard();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(t);
  }, [state.globalSymbol]);

  return (
    <div
      className={`flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-hub-darker rounded-lg border transition-colors ${
        flash ? 'border-hub-yellow/40' : 'border-white/[0.06]'
      }`}
    >
      {/* Quick symbol pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {QUICK_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => dispatch({ type: 'SET_SYMBOL', symbol: s })}
            className={`px-2 py-0.5 text-xs font-mono rounded transition-all whitespace-nowrap ${
              state.globalSymbol === s
                ? 'bg-hub-yellow/20 text-hub-yellow border border-hub-yellow/30'
                : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Full search for arbitrary symbol */}
      <div className="hidden sm:block">
        <CoinSearch
          compact
          placeholder="Search..."
          onSelect={(coin) => dispatch({ type: 'SET_SYMBOL', symbol: coin.symbol.toUpperCase() })}
        />
      </div>

      <div className="w-px h-4 bg-white/[0.08] mx-1 flex-shrink-0" />

      {/* Timeframe pills */}
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => dispatch({ type: 'SET_TIMEFRAME', tf: tf.value })}
            className={`px-2 py-0.5 text-xs font-mono rounded transition-all ${
              state.globalTimeframe === tf.value
                ? 'bg-white/10 text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Current symbol indicator */}
      <div className="ml-auto text-[10px] text-neutral-600 font-mono hidden sm:block">
        Synced: <span className="text-hub-yellow">{state.globalSymbol}</span>
      </div>
    </div>
  );
}
