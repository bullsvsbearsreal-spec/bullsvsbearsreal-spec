'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

export default function BtcChartWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [prices, setPrices] = useState<number[] | null>(null);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; price: number; date: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7',
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted || !data.prices) return;
        const pts = data.prices.map((p: [number, number]) => p[1]);
        const ts = data.prices.map((p: [number, number]) => p[0]);
        setPrices(pts);
        setTimestamps(ts);
        setCurrent(pts[pts.length - 1]);
        setUpdatedAt(Date.now());
      } catch (err) { console.error('[BtcChart] fetch error:', err); }
    })();
    return () => { mounted = false; };
  }, []);

  // Draw sparkline
  useEffect(() => {
    if (!prices || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const up = prices[prices.length - 1] >= prices[0];

    // Brand-consistent colors: orange for up (matches hub accent), red for down
    const lineColor = up ? '#FFA500' : '#ef4444';
    const gradTop = up ? 'rgba(255,165,0,0.20)' : 'rgba(239,68,68,0.18)';
    const gradMid = up ? 'rgba(255,165,0,0.06)' : 'rgba(239,68,68,0.06)';

    ctx.clearRect(0, 0, w, h);

    // Draw line
    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Richer gradient fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, gradTop);
    grad.addColorStop(0.5, gradMid);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle grid lines
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const gy = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // End dot
    const lastX = w;
    const lastY = h - ((prices[prices.length - 1] - min) / range) * (h - 8) - 4;
    ctx.beginPath();
    ctx.arc(lastX - 1, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX - 1, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = up ? 'rgba(255,165,0,0.2)' : 'rgba(239,68,68,0.2)';
    ctx.fill();
  }, [prices]);

  // Hover handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!prices || !containerRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const idx = Math.round((mx / rect.width) * (prices.length - 1));
      const clamped = Math.max(0, Math.min(prices.length - 1, idx));
      const ts = timestamps[clamped];
      const d = ts ? new Date(ts) : new Date();
      setHover({
        x: (clamped / (prices.length - 1)) * rect.width,
        price: prices[clamped],
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
    },
    [prices, timestamps],
  );

  if (!prices) return <WidgetSkeleton variant="chart" />;

  const change7d = prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;
  const up = change7d >= 0;

  return (
    <div ref={containerRef}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-lg font-bold text-white tabular-nums">
            ${(hover?.price ?? current)?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          {!hover && (
            <span className={`ml-2 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
              {up ? '+' : ''}{change7d.toFixed(1)}%
            </span>
          )}
          {hover && (
            <span className="ml-2 text-[10px] text-neutral-500">{hover.date}</span>
          )}
        </div>
        <span className="text-[10px] text-neutral-600">7d</span>
      </div>
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} className="w-full h-20 cursor-crosshair" />
        {/* Hover crosshair */}
        {hover && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none"
            style={{ left: `${hover.x}px` }}
          />
        )}
      </div>
      {/* Subtle axis labels */}
      <div className="flex justify-between mt-1 text-[9px] text-neutral-700 tabular-nums">
        <span>
          {timestamps[0] ? new Date(timestamps[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </span>
        <UpdatedAgo ts={updatedAt} />
        <span>
          {timestamps[timestamps.length - 1] ? new Date(timestamps[timestamps.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </span>
      </div>
    </div>
  );
}
