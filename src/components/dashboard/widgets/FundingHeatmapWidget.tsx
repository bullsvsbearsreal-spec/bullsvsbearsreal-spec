'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';
import { useDashboardOptional } from '../DashboardContext';

interface FundingRate {
  symbol: string;
  exchange: string;
  fundingRate: number;
}

/** Map funding rate to intensity class */
function getIntensityClass(rate: number): string {
  if (rate > 0.1) return 'heatmap-extreme-pos';
  if (rate > 0.05) return 'heatmap-hot-pos';
  if (rate > 0.01) return 'heatmap-mild-pos';
  if (rate < -0.1) return 'heatmap-extreme-neg';
  if (rate < -0.05) return 'heatmap-hot-neg';
  if (rate < -0.01) return 'heatmap-mild-neg';
  return 'heatmap-neutral';
}

/** Trader slang for heatmap tooltip */
function getHeatmapSlang(rate: number): string {
  if (rate > 0.1) return ' — Longs paying heavy premium';
  if (rate < -0.1) return ' — Shorts paying through the nose';
  if (rate > 0.05) return ' — Bullish pressure building';
  if (rate < -0.05) return ' — Bears in control';
  return '';
}

export default function FundingHeatmapWidget() {
  const [rates, setRates] = useState<FundingRate[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const fetchCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/funding?limit=30');
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.data || data.rates || [];
        if (mounted) {
          setRates(items.slice(0, 20));
          setUpdatedAt(Date.now());
          // Flash micro-glow on refresh (skip first load)
          if (fetchCount.current > 0) {
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 1000);
          }
          fetchCount.current++;
        }
      } catch (err) { console.error('[FundingHeatmap] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const dashCtx = useDashboardOptional();

  if (rates === null) return <WidgetSkeleton variant="heatmap" />;

  if (rates.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-neutral-500">No funding rates yet</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">Waiting for next funding update</p>
      </div>
    );
  }

  return (
    <div className={justUpdated ? 'data-updated' : ''}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {rates.slice(0, 18).map((r, i) => {
          const rate = r.fundingRate;
          const intensityClass = getIntensityClass(rate);
          const slang = getHeatmapSlang(rate);
          const isExtreme = Math.abs(rate) > 0.05;

          return (
            <div
              key={`${r.symbol}-${r.exchange}-${i}`}
              onClick={() => {
                const sym = r.symbol?.replace(/USDT$/, '');
                if (sym) dashCtx?.dispatch({ type: 'SET_SYMBOL', symbol: sym });
              }}
              className={`heatmap-tile ${intensityClass} cursor-pointer`}
              title={`${r.symbol} ${r.exchange}: ${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%${slang}`}
            >
              <span className="heatmap-tile-symbol">
                {r.symbol?.replace(/USDT$/, '').slice(0, 5)}
              </span>
              <span className={`heatmap-tile-value ${isExtreme ? 'font-black' : ''}`}>
                {rate >= 0 ? '+' : ''}{rate.toFixed(3)}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <Link href="/funding-heatmap" className="text-[10px] text-hub-yellow hover:underline font-medium">
          View full heatmap
        </Link>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
