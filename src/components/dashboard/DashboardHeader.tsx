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
  ethPrice: number | null;
  ethChange: number | null;
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

function fgRegime(v: number): { label: string; color: string } {
  if (v <= 20) return { label: 'Extreme Fear',  color: 'text-rose-500' };
  if (v <= 40) return { label: 'Fear',          color: 'text-orange-400' };
  if (v <= 60) return { label: 'Neutral',       color: 'text-amber-400' };
  if (v <= 80) return { label: 'Greed',         color: 'text-lime-400' };
  return         { label: 'Extreme Greed', color: 'text-emerald-400' };
}

/** Compact stat pill — used in the dashboard header strip */
function StatPill({
  label, value, delta, valueClass, sublabel, sublabelClass,
}: {
  label: string;
  value: string;
  delta?: number;
  valueClass?: string;
  sublabel?: string;
  sublabelClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
      <span className={`text-xs font-mono tabular-nums font-semibold ${valueClass ?? 'text-white'}`}>
        {value}
      </span>
      {sublabel && (
        <span className={`text-[10px] font-medium ${sublabelClass ?? 'text-neutral-500'}`}>
          {sublabel}
        </span>
      )}
      {delta != null && Number.isFinite(delta) && (
        <span className={`flex items-center gap-0.5 text-[10px] font-mono tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {delta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export default function DashboardHeader({ userName }: { userName: string }) {
  const [stats, setStats] = useState<HeaderStats>({
    btcPrice: null, btcChange: null, ethPrice: null, ethChange: null,
    fearGreed: null, marketCapChange: null, totalMarketCap: null, btcDominance: null,
  });
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [tickerRes, fgRes, globalRes] = await Promise.allSettled([
        fetch('/api/tickers?symbols=BTC,ETH', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
        fetch('/api/fear-greed', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
        fetch('/api/global-stats', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null),
      ]);

      if (!mounted) return;

      const tickerData = tickerRes.status === 'fulfilled' ? tickerRes.value : null;
      const tickers = Array.isArray(tickerData) ? tickerData : tickerData?.data || [];
      const findT = (sym: string) =>
        Array.isArray(tickers) ? tickers.find((t: any) => t.symbol === sym || t.symbol === `${sym}USDT`) : null;
      const btc = findT('BTC');
      const eth = findT('ETH');

      const fgData = fgRes.status === 'fulfilled' ? fgRes.value : null;
      const globalData = globalRes.status === 'fulfilled' ? globalRes.value : null;

      setStats({
        btcPrice: btc?.price || btc?.lastPrice || null,
        btcChange: btc?.priceChangePercent ?? btc?.priceChangePercent24h ?? btc?.change24h ?? null,
        ethPrice: eth?.price || eth?.lastPrice || null,
        ethChange: eth?.priceChangePercent ?? eth?.priceChangePercent24h ?? eth?.change24h ?? null,
        fearGreed: fgData?.value ?? null,
        marketCapChange: globalData?.market_cap_change_percentage_24h_usd ?? null,
        totalMarketCap: globalData?.total_market_cap?.usd ?? null,
        btcDominance: globalData?.market_cap_percentage?.btc ?? null,
      });
      setUpdatedAt(Date.now());
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const fmtPrice = (p: number) => '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtCap = (n: number) => n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : `$${(n / 1e9).toFixed(0)}B`;
  const fgInfo = stats.fearGreed != null ? fgRegime(stats.fearGreed) : null;

  return (
    <div className="mb-5 flex-1 min-w-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          {getGreeting()}, <span className="text-gradient">{userName}</span>
        </h1>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live</span>
          {updatedAt && (
            <span className="text-neutral-700">
              · synced {Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))}s ago
            </span>
          )}
        </div>
      </div>

      {/* Quick stats — pill row */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {stats.btcPrice !== null && (
          <StatPill label="BTC" value={fmtPrice(stats.btcPrice)} delta={stats.btcChange ?? undefined} />
        )}
        {stats.ethPrice !== null && (
          <StatPill label="ETH" value={fmtPrice(stats.ethPrice)} delta={stats.ethChange ?? undefined} />
        )}
        {stats.totalMarketCap !== null && (
          <StatPill label="MCap" value={fmtCap(stats.totalMarketCap)} delta={stats.marketCapChange ?? undefined} />
        )}
        {stats.btcDominance !== null && (
          <StatPill label="BTC.D" value={`${stats.btcDominance.toFixed(1)}%`} />
        )}
        {stats.fearGreed !== null && fgInfo && (
          <StatPill
            label="F&G"
            value={String(stats.fearGreed)}
            valueClass={fgInfo.color}
            sublabel={fgInfo.label}
            sublabelClass={fgInfo.color}
          />
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
