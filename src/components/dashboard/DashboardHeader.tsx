'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface HeaderStats {
  btcPrice: number | null;
  btcChange: number | null;
  fearGreed: number | null;
  marketCapChange: number | null;
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
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [tickerRes, fgRes, globalRes] = await Promise.allSettled([
        fetch('/api/tickers').then(r => r.ok ? r.json() : null),
        fetch('/api/fear-greed').then(r => r.ok ? r.json() : null),
        fetch('/api/global-stats').then(r => r.ok ? r.json() : null),
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
      });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const fmtPrice = (p: number) => '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });

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
        {stats.marketCapChange !== null && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500">Market</span>
            <span className={`flex items-center gap-0.5 font-medium ${stats.marketCapChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.marketCapChange >= 0 ? '+' : ''}{stats.marketCapChange.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
