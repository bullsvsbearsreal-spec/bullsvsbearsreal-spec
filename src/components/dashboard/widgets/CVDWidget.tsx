'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import AnimatedValue from '../AnimatedValue';
import UpdatedAgo from '../UpdatedAgo';
import { useDashboardOptional } from '../DashboardContext';

interface CVDBucket {
  time: number;
  buyVol: number;
  sellVol: number;
  delta: number;
  cvd: number;
}

export default function CVDWidget({ wide, widgetId }: { wide?: boolean; widgetId?: string }) {
  const ctx = useDashboardOptional();
  const symbol = (widgetId && ctx) ? ctx.getWidgetSymbol(widgetId) : 'BTC';

  const [buckets, setBuckets] = useState<CVDBucket[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;
    setBuckets(null);
    const load = async () => {
      try {
        const res = await fetch(`/api/aggtrades?symbol=${symbol}&limit=500`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          // 502 = all upstream trade sources failed (symbol not on Binance/Bybit/etc).
          // Render an empty state instead of leaving the widget perpetually loading.
          if (mounted && res.status === 502) setBuckets([]);
          return;
        }
        const json = await res.json();
        if (!mounted) return;

        // /api/aggtrades already buckets trades into 1-min intervals and
        // computes cumulative delta server-side — use those directly.
        // Previous code read `json.trades` which doesn't exist on the
        // response, then fell through to `json` itself and tried to iterate
        // it, throwing "TypeError: <x> is not iterable" for every symbol.
        const apiBuckets = Array.isArray(json?.buckets) ? json.buckets : [];

        const sorted: CVDBucket[] = apiBuckets
          .filter((b: any) => b && typeof b.time === 'number')
          .map((b: any) => ({
            time: b.time,
            buyVol: Number(b.buyVol) || 0,
            sellVol: Number(b.sellVol) || 0,
            delta: Number(b.delta) || 0,
            cvd: Number(b.cvd) || 0,
          }))
          .sort((a: CVDBucket, b: CVDBucket) => a.time - b.time);

        setBuckets(sorted);
        setUpdatedAt(Date.now());
      } catch (err) {
        // Network/abort errors — keep prior buckets (don't clear).
        console.error(`[CVDWidget] fetch error for ${symbol}:`, err);
      }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [symbol]);

  // Draw mini CVD sparkline
  useEffect(() => {
    if (!buckets || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx2d.scale(dpr, dpr);
    ctx2d.clearRect(0, 0, w, h);

    if (buckets.length < 2) return;

    const cvdValues = buckets.map((b) => b.cvd);
    const min = Math.min(...cvdValues);
    const max = Math.max(...cvdValues);
    const range = max - min || 1;
    const lastCvd = cvdValues[cvdValues.length - 1];
    const up = lastCvd >= 0;

    // Area fill
    ctx2d.beginPath();
    buckets.forEach((b, i) => {
      const x = (i / (buckets.length - 1)) * w;
      const y = h - ((b.cvd - min) / range) * (h - 4) - 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    });
    // Line stroke
    ctx2d.strokeStyle = up ? '#22c55e' : '#ef4444';
    ctx2d.lineWidth = 1.5;
    ctx2d.lineJoin = 'round';
    ctx2d.stroke();

    // Fill under
    ctx2d.lineTo(w, h);
    ctx2d.lineTo(0, h);
    ctx2d.closePath();
    const grad = ctx2d.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, up ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)');
    grad.addColorStop(1, 'transparent');
    ctx2d.fillStyle = grad;
    ctx2d.fill();

    // Zero line
    const zeroY = h - ((0 - min) / range) * (h - 4) - 2;
    if (zeroY > 0 && zeroY < h) {
      ctx2d.setLineDash([2, 3]);
      ctx2d.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, zeroY);
      ctx2d.lineTo(w, zeroY);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
    }
  }, [buckets]);

  if (!buckets) return <WidgetSkeleton variant="chart" />;

  const lastBucket = buckets[buckets.length - 1];
  const lastCvd = lastBucket?.cvd ?? 0;
  const lastDelta = lastBucket?.delta ?? 0;
  const totalBuyVol = buckets.reduce((s, b) => s + b.buyVol, 0);
  const totalSellVol = buckets.reduce((s, b) => s + b.sellVol, 0);

  const fmtVol = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : `$${(a / 1e3).toFixed(0)}K`; };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">{symbol} CVD</span>
          <span className={`flex items-center gap-0.5 text-xs font-medium ${lastCvd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {lastCvd >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtVol(Math.abs(lastCvd))}
          </span>
        </div>
        <UpdatedAgo ts={updatedAt} />
      </div>

      <canvas ref={canvasRef} className="w-full h-16" role="img" aria-label={`${symbol} cumulative volume delta sparkline`} />

      <div className="flex items-center justify-between mt-2 text-[10px]">
        <div className="flex items-center gap-3">
          <span className="text-green-400">Buy {fmtVol(totalBuyVol)}</span>
          <span className="text-red-400">Sell {fmtVol(totalSellVol)}</span>
        </div>
        <span className={`font-mono ${lastDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          delta {lastDelta >= 0 ? '+' : ''}{fmtVol(lastDelta)}
        </span>
      </div>
    </div>
  );
}
