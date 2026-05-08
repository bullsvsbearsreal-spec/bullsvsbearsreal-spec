'use client';

/**
 * MarketPulseWidget — at-a-glance macro snapshot.
 *
 * Four mini-cards: BTC, ETH, total market cap, 24h volume — each with
 * 24h delta where available. Designed for a wide (2-col) widget slot
 * but degrades gracefully into a 2x2 grid on narrow.
 *
 * Data: /api/tickers (BTC + ETH) + /api/global-stats. Both already
 * cached at the L1 + CF level so this widget barely costs anything.
 */

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface Ticker {
  symbol: string;
  price?: number;
  lastPrice?: number;
  priceChangePercent24h?: number;
  change24h?: number;
}

interface GlobalStats {
  total_market_cap?: { usd?: number };
  total_volume?: { usd?: number };
  market_cap_change_percentage_24h_usd?: number;
}

function fmtPrice(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function fmtCompact(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function PulseCard({
  label, value, delta, accent,
}: { label: string; value: string; delta?: number; accent: string }) {
  const isPositive = delta != null && delta >= 0;
  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/[0.06] bg-gradient-to-br ${accent} px-2.5 py-2`}>
      <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">
        {label}
      </div>
      <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-white">
        {value}
      </div>
      {delta != null && Number.isFinite(delta) && (
        <div className={`text-[10px] font-mono tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-0.5`}>
          {isPositive
            ? <TrendingUp className="w-2.5 h-2.5" />
            : <TrendingDown className="w-2.5 h-2.5" />}
          {fmtPct(delta)}
        </div>
      )}
    </div>
  );
}

export default function MarketPulseWidget() {
  const [tickers, setTickers] = useState<Ticker[] | null>(null);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch('/api/tickers?symbols=BTC,ETH', { signal: AbortSignal.timeout(10_000) }),
          fetch('/api/global-stats', { signal: AbortSignal.timeout(10_000) }),
        ]);
        if (tRes.ok) {
          const tJson = await tRes.json();
          const rows: Ticker[] = Array.isArray(tJson) ? tJson : (tJson?.data ?? []);
          if (mounted) setTickers(rows);
        }
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (mounted) setStats(sJson);
        }
        if (mounted) setUpdatedAt(Date.now());
      } catch (err) { console.error('[MarketPulse] error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!tickers && !stats) return <WidgetSkeleton variant="grid" />;

  const find = (sym: string) => tickers?.find(t => t.symbol === sym || t.symbol === `${sym}USDT`);
  const btc = find('BTC');
  const eth = find('ETH');

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <PulseCard
          label="Bitcoin"
          value={fmtPrice(btc?.price ?? btc?.lastPrice)}
          delta={btc?.priceChangePercent24h ?? btc?.change24h}
          accent="from-amber-500/15 to-transparent"
        />
        <PulseCard
          label="Ethereum"
          value={fmtPrice(eth?.price ?? eth?.lastPrice)}
          delta={eth?.priceChangePercent24h ?? eth?.change24h}
          accent="from-blue-500/15 to-transparent"
        />
        <PulseCard
          label="Market cap"
          value={fmtCompact(stats?.total_market_cap?.usd)}
          delta={stats?.market_cap_change_percentage_24h_usd}
          accent="from-emerald-500/15 to-transparent"
        />
        <PulseCard
          label="24h volume"
          value={fmtCompact(stats?.total_volume?.usd)}
          accent="from-violet-500/15 to-transparent"
        />
      </div>
      <div className="flex justify-end">
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
