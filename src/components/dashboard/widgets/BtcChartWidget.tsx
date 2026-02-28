'use client';

import { useState, useEffect, useRef } from 'react';

export default function BtcChartWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prices, setPrices] = useState<number[] | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Use CoinGecko market_chart for 7-day sparkline
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7',
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted || !data.prices) return;
        const pts = data.prices.map((p: [number, number]) => p[1]);
        setPrices(pts);
        setCurrent(pts[pts.length - 1]);
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

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = up ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Gradient fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [prices]);

  if (!prices) {
    return <div className="h-24 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  const change7d = prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;
  const up = change7d >= 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-lg font-bold text-white">
            ${current?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className={`ml-2 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? '+' : ''}{change7d.toFixed(1)}%
          </span>
        </div>
        <span className="text-[10px] text-neutral-600">7d</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-20" />
    </div>
  );
}
