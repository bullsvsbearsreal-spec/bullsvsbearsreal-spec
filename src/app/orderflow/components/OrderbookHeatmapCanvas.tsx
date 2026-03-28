'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

export interface HeatmapColumn {
  timestamp: number;
  midPrice: number;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  trades?: Array<{ price: number; quantity: number; side: 'buy' | 'sell' }>;
}

interface OrderbookHeatmapCanvasProps {
  columns: HeatmapColumn[];
  pricePrecision?: number;
  visiblePriceRange?: number; // % from mid
  height?: number;
  className?: string;
}

// Color mapping — log scale intensity for bids (green)
function bidColor(quantity: number, maxQ: number): string {
  if (quantity <= 0) return 'transparent';
  const intensity = Math.log1p(quantity) / Math.log1p(maxQ);
  const alpha = Math.min(0.9, 0.05 + intensity * 0.85);
  const g = Math.round(120 + intensity * 135);
  return `rgba(34, ${g}, 94, ${alpha})`;
}

// Color mapping — log scale intensity for asks (red)
function askColor(quantity: number, maxQ: number): string {
  if (quantity <= 0) return 'transparent';
  const intensity = Math.log1p(quantity) / Math.log1p(maxQ);
  const alpha = Math.min(0.9, 0.05 + intensity * 0.85);
  const r = Math.round(180 + intensity * 75);
  return `rgba(${r}, 68, 68, ${alpha})`;
}

export default function OrderbookHeatmapCanvas({
  columns,
  pricePrecision = 1,
  visiblePriceRange = 0.5,
  height = 500,
  className,
}: OrderbookHeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);
  const rafRef = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; price: string; quantity: string; time: string; side: string;
  } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dirtyRef.current) return;
    dirtyRef.current = false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    if (columns.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Accumulating orderbook snapshots...', w / 2, h / 2);
      return;
    }

    const AXIS_W = 55; // right axis width
    const plotW = w - AXIS_W;

    const lastMid = columns[columns.length - 1].midPrice;
    const priceTop = lastMid * (1 + visiblePriceRange / 100);
    const priceBottom = lastMid * (1 - visiblePriceRange / 100);
    const priceRange = priceTop - priceBottom;

    const colWidth = Math.max(2, Math.floor(plotW / Math.min(columns.length, 300)));
    const visibleCols = Math.min(columns.length, Math.floor(plotW / colWidth));
    const startCol = Math.max(0, columns.length - visibleCols);

    // Find max quantity for color scaling
    let maxQ = 0;
    for (let i = startCol; i < columns.length; i++) {
      const col = columns[i];
      for (const l of col.bids) { if (l.quantity > maxQ) maxQ = l.quantity; }
      for (const l of col.asks) { if (l.quantity > maxQ) maxQ = l.quantity; }
    }
    if (maxQ === 0) maxQ = 1;

    const toY = (price: number) => h - ((price - priceBottom) / priceRange) * h;
    const bucketH = Math.max(1, (pricePrecision / priceRange) * h);

    // Draw heatmap cells
    for (let i = startCol; i < columns.length; i++) {
      const col = columns[i];
      const x = (i - startCol) * colWidth;

      for (const level of col.bids) {
        if (level.price < priceBottom || level.price > priceTop) continue;
        const y = toY(level.price);
        ctx.fillStyle = bidColor(level.quantity, maxQ);
        ctx.fillRect(x, y, colWidth - 0.5, bucketH);
      }

      for (const level of col.asks) {
        if (level.price < priceBottom || level.price > priceTop) continue;
        const y = toY(level.price);
        ctx.fillStyle = askColor(level.quantity, maxQ);
        ctx.fillRect(x, y - bucketH, colWidth - 0.5, bucketH);
      }
    }

    // Mid-price line overlay
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = startCol; i < columns.length; i++) {
      const x = (i - startCol) * colWidth + colWidth / 2;
      const y = toY(columns[i].midPrice);
      if (i === startCol) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Trade execution dots
    for (let i = startCol; i < columns.length; i++) {
      const col = columns[i];
      const x = (i - startCol) * colWidth + colWidth / 2;
      if (!col.trades) continue;
      for (const t of col.trades) {
        if (t.price < priceBottom || t.price > priceTop) continue;
        const y = toY(t.price);
        const radius = Math.min(5, Math.max(1.5, Math.log10(t.quantity + 1) * 1.5));
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = t.side === 'buy' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        ctx.fill();
      }
    }

    // Liquidity walls — highlight large resting orders
    const wallThreshold = maxQ * 0.6;
    ctx.save();
    for (let i = startCol; i < columns.length; i++) {
      const col = columns[i];
      const x = (i - startCol) * colWidth;
      for (const level of [...col.bids, ...col.asks]) {
        if (level.quantity > wallThreshold && level.price >= priceBottom && level.price <= priceTop) {
          const y = toY(level.price);
          ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
          ctx.fillRect(x, y - 1.5, colWidth, 3);
        }
      }
    }
    ctx.restore();

    // Price axis labels (right side)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const labelCount = 10;
    for (let i = 0; i <= labelCount; i++) {
      const price = priceBottom + (priceRange / labelCount) * i;
      const y = toY(price);
      const fmt = price >= 1000 ? price.toFixed(0) : price.toFixed(2);
      ctx.fillText(fmt, w - 4, y + 3);
    }

    // Time axis (bottom, sparse)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.textAlign = 'center';
    const timeLabels = 5;
    for (let i = 0; i < timeLabels; i++) {
      const colIdx = startCol + Math.floor((visibleCols / timeLabels) * i);
      if (colIdx >= columns.length) continue;
      const x = (colIdx - startCol) * colWidth + colWidth / 2;
      const t = new Date(columns[colIdx].timestamp);
      ctx.fillText(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x, h - 2);
    }
  }, [columns, pricePrecision, visiblePriceRange, height]);

  // Re-draw on data change
  useEffect(() => {
    dirtyRef.current = true;
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      dirtyRef.current = true;
      rafRef.current = requestAnimationFrame(draw);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // Hover handler
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || columns.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const AXIS_W = 55;
      const plotW = w - AXIS_W;

      const colWidth = Math.max(2, Math.floor(plotW / Math.min(columns.length, 300)));
      const visibleCols = Math.min(columns.length, Math.floor(plotW / colWidth));
      const startCol = Math.max(0, columns.length - visibleCols);

      const colIdx = Math.min(columns.length - 1, startCol + Math.floor(mx / colWidth));
      const col = columns[colIdx];
      if (!col) { setTooltip(null); return; }

      const lastMid = columns[columns.length - 1].midPrice;
      const priceTop = lastMid * (1 + visiblePriceRange / 100);
      const priceBottom = lastMid * (1 - visiblePriceRange / 100);
      const priceRange = priceTop - priceBottom;
      const price = priceTop - (my / h) * priceRange;

      // Find nearest level
      const allLevels = [...col.bids, ...col.asks];
      let nearest = allLevels[0];
      let nearestDist = Infinity;
      for (const l of allLevels) {
        const d = Math.abs(l.price - price);
        if (d < nearestDist) { nearest = l; nearestDist = d; }
      }

      const isBid = col.bids.includes(nearest);
      const t = new Date(col.timestamp);

      setTooltip({
        x: mx,
        y: my,
        price: nearest ? nearest.price.toFixed(nearest.price >= 1000 ? 0 : 2) : price.toFixed(2),
        quantity: nearest ? nearest.quantity.toFixed(4) : '0',
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        side: isBid ? 'bid' : 'ask',
      });
    },
    [columns, visiblePriceRange],
  );

  return (
    <div className={`relative ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height }}
        className="rounded-lg"
        role="img"
        aria-label="Orderbook depth heatmap showing bid and ask liquidity over time"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-hub-darker/95 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono z-10 space-y-0.5"
          style={{
            left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 400) - 150),
            top: Math.max(0, tooltip.y - 50),
          }}
        >
          <div className="text-neutral-400">{tooltip.time}</div>
          <div>
            <span className={tooltip.side === 'bid' ? 'text-green-400' : 'text-red-400'}>
              {tooltip.side.toUpperCase()}
            </span>
            {' '}
            <span className="text-white">${tooltip.price}</span>
          </div>
          <div className="text-neutral-500">Qty: {tooltip.quantity}</div>
        </div>
      )}
    </div>
  );
}
