'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { getExchangeHexColor } from '@/lib/constants/exchange-colors';

interface DepthCurvePoint {
  priceOffset: number;
  cumulativeUsd: number;
}

interface InteractiveDepthChartProps {
  bidCurves: Record<string, DepthCurvePoint[]>;
  askCurves: Record<string, DepthCurvePoint[]>;
  orderSizeUsd: number;
  onOrderSizeChange: (size: number) => void;
  height?: number;
  className?: string;
}

export default function InteractiveDepthChart({
  bidCurves,
  askCurves,
  orderSizeUsd,
  onOrderSizeChange,
  height = 300,
  className,
}: InteractiveDepthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; exchange: string; offset: string; depth: string;
  } | null>(null);

  // Find all exchanges present
  const exchanges = Array.from(new Set(Object.keys(bidCurves).concat(Object.keys(askCurves))));

  // Compute scale limits
  const allPoints = [...Object.values(bidCurves), ...Object.values(askCurves)].flat();
  const maxDepth = Math.max(...allPoints.map((p) => p.cumulativeUsd), orderSizeUsd * 1.5, 10000);
  const maxOffset = 2; // 2% from mid

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    const PAD = 40;
    const midX = w / 2;
    const plotH = h - PAD;
    const plotW = w - PAD * 2;

    const toX = (offset: number) => midX + (offset / maxOffset) * (plotW / 2);
    const toY = (depth: number) => plotH - (depth / maxDepth) * (plotH - 20);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = toY((maxDepth / 4) * i);
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(w - PAD, y);
      ctx.stroke();
    }

    // Mid-price line
    ctx.strokeStyle = '#eab30866';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, 10);
    ctx.lineTo(midX, plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BIDS', midX - plotW / 4, h - 4);
    ctx.fillText('ASKS', midX + plotW / 4, h - 4);
    ctx.fillText('Mid', midX, h - 4);

    // Y-axis labels
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const val = (maxDepth / 4) * i;
      const y = toY(val);
      const label = val >= 1e6 ? `$${(val / 1e6).toFixed(1)}M` : `$${(val / 1e3).toFixed(0)}K`;
      ctx.fillText(label, 2, y + 3);
    }

    // Draw bid curves (left side, green tones)
    Object.entries(bidCurves).forEach(([exchange, curve]) => {
      if (curve.length < 2) return;
      const color = getExchangeHexColor(exchange);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      curve.forEach((p, i) => {
        const x = toX(-p.priceOffset);
        const y = toY(p.cumulativeUsd);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill
      ctx.fillStyle = color + '12';
      ctx.beginPath();
      ctx.moveTo(midX, plotH);
      curve.forEach((p) => ctx.lineTo(toX(-p.priceOffset), toY(p.cumulativeUsd)));
      ctx.lineTo(toX(-maxOffset), plotH);
      ctx.closePath();
      ctx.fill();
    });

    // Draw ask curves (right side)
    Object.entries(askCurves).forEach(([exchange, curve]) => {
      if (curve.length < 2) return;
      const color = getExchangeHexColor(exchange);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      curve.forEach((p, i) => {
        const x = toX(p.priceOffset);
        const y = toY(p.cumulativeUsd);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = color + '12';
      ctx.beginPath();
      ctx.moveTo(midX, plotH);
      curve.forEach((p) => ctx.lineTo(toX(p.priceOffset), toY(p.cumulativeUsd)));
      ctx.lineTo(toX(maxOffset), plotH);
      ctx.closePath();
      ctx.fill();
    });

    // Order size line (horizontal, draggable)
    const orderY = toY(orderSizeUsd);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD, orderY);
    ctx.lineTo(w - PAD, orderY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Order size label
    ctx.fillStyle = '#eab308';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    const sizeLabel = orderSizeUsd >= 1e6 ? `$${(orderSizeUsd / 1e6).toFixed(1)}M` : `$${(orderSizeUsd / 1e3).toFixed(0)}K`;
    ctx.fillText(sizeLabel, w - PAD - 4, orderY - 4);

    // Drag handle indicator
    ctx.beginPath();
    ctx.arc(w - PAD, orderY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#eab308';
    ctx.fill();

    // Exchange legend (bottom-right)
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    exchanges.forEach((ex, i) => {
      const color = getExchangeHexColor(ex);
      const ly = 16 + i * 14;
      ctx.fillStyle = color;
      ctx.fillRect(w - PAD - 8, ly - 4, 6, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(ex, w - PAD - 12, ly + 2);
    });
  }, [bidCurves, askCurves, orderSizeUsd, maxDepth, exchanges]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // Drag to change order size
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = canvas.clientHeight;
      const PAD = 40;
      const plotH = h - PAD;

      if (isDragging) {
        const depth = ((plotH - y) / (plotH - 20)) * maxDepth;
        const clamped = Math.max(1000, Math.min(maxDepth, depth));
        const snapped = Math.round(clamped / 1000) * 1000;
        onOrderSizeChange(snapped);
      } else {
        // Tooltip on hover near a curve
        const x = e.clientX - rect.left;
        const midX = canvas.clientWidth / 2;
        const offset = ((x - midX) / (canvas.clientWidth / 2 - PAD)) * maxOffset;
        const depth = ((plotH - y) / (plotH - 20)) * maxDepth;

        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          exchange: '',
          offset: `${Math.abs(offset).toFixed(2)}%`,
          depth: depth >= 1e6 ? `$${(depth / 1e6).toFixed(1)}M` : `$${(depth / 1e3).toFixed(0)}K`,
        });
      }
    },
    [isDragging, maxDepth, onOrderSizeChange],
  );

  return (
    <div className={`relative ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height }}
        className="rounded-lg cursor-ns-resize"
        role="img"
        aria-label="Interactive multi-exchange depth chart — drag to change order size"
        onPointerDown={() => setIsDragging(true)}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setIsDragging(false)}
        onPointerLeave={() => { setIsDragging(false); setTooltip(null); }}
      />
      {tooltip && !isDragging && (
        <div
          className="absolute pointer-events-none bg-hub-darker border border-white/10 rounded px-2 py-1 text-[10px] font-mono z-10"
          style={{ left: Math.min(tooltip.x + 12, (canvasRef.current?.clientWidth ?? 400) - 160), top: tooltip.y - 30 }}
        >
          <span className="text-neutral-400">{tooltip.offset} from mid</span>
          {' · '}
          <span className="text-hub-yellow">{tooltip.depth}</span>
        </div>
      )}
    </div>
  );
}
