'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import WidgetSkeleton from '../WidgetSkeleton';
import AnimatedValue from '../AnimatedValue';
import UpdatedAgo from '../UpdatedAgo';

interface GlobalStats {
  marketCap: number;
  volume24h: number;
  btcDom: number;
  ethDom: number;
  change24h: number;
}

export default function MarketOverviewWidget() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/global-stats');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setStats({
          marketCap: data.total_market_cap?.usd || 0,
          volume24h: data.total_volume?.usd || 0,
          btcDom: data.market_cap_percentage?.btc || 0,
          ethDom: data.market_cap_percentage?.eth || 0,
          change24h: data.market_cap_change_percentage_24h_usd || 0,
        });
        setUpdatedAt(Date.now());
      } catch (err) { console.error('[MarketOverview] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!stats) return <WidgetSkeleton variant="grid" />;

  const fmtUsd = (v: number) => {
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
    return '$' + v.toFixed(0);
  };

  const up = stats.change24h >= 0;
  // Volume/MCap ratio as percentage — higher = more active market
  const volMcapRatio = stats.marketCap > 0 ? (stats.volume24h / stats.marketCap) * 100 : 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-neutral-500 mb-0.5">Market Cap</p>
          <AnimatedValue value={stats.marketCap} format={fmtUsd} className="text-sm font-bold text-white tabular-nums" />
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {up ? '+' : ''}{stats.change24h.toFixed(1)}%
          </span>
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 mb-0.5">24h Volume</p>
          <AnimatedValue value={stats.volume24h} format={fmtUsd} className="text-sm font-bold text-white tabular-nums" />
          <span className="text-[10px] text-neutral-600">
            {volMcapRatio.toFixed(1)}% of mcap
          </span>
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 mb-0.5">BTC Dom</p>
          <div className="flex items-center gap-1.5">
            <TokenIconSimple symbol="BTC" size={12} />
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-orange-400" style={{ width: `${stats.btcDom}%` }} />
            </div>
            <span className="text-[10px] text-neutral-300 tabular-nums">{stats.btcDom.toFixed(1)}%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 mb-0.5">ETH Dom</p>
          <div className="flex items-center gap-1.5">
            <TokenIconSimple symbol="ETH" size={12} />
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-purple-400" style={{ width: `${stats.ethDom}%` }} />
            </div>
            <span className="text-[10px] text-neutral-300 tabular-nums">{stats.ethDom.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      <div className="text-right mt-2"><UpdatedAgo ts={updatedAt} /></div>
    </div>
  );
}
