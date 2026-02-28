'use client';

import { useState, useEffect } from 'react';
import WidgetSkeleton from '../WidgetSkeleton';
import AnimatedValue from '../AnimatedValue';

const COLORS: Record<string, string> = {
  'Extreme Fear': 'text-red-400',
  Fear: 'text-orange-400',
  Neutral: 'text-yellow-400',
  Greed: 'text-green-400',
  'Extreme Greed': 'text-emerald-400',
};

/** Hex fill colors for the gauge needle glow */
const FILL_COLORS: Record<string, string> = {
  'Extreme Fear': '#ef4444',
  Fear: '#f97316',
  Neutral: '#eab308',
  Greed: '#22c55e',
  'Extreme Greed': '#10b981',
};

function getLabel(val: number): string {
  if (val <= 20) return 'Extreme Fear';
  if (val <= 40) return 'Fear';
  if (val <= 60) return 'Neutral';
  if (val <= 80) return 'Greed';
  return 'Extreme Greed';
}

/**
 * SVG semicircle gauge — 0 (left/red) to 100 (right/green).
 * Uses a gradient arc with a needle indicator.
 */
function GaugeArc({ value }: { value: number }) {
  // Arc geometry: semicircle from 180° (left) to 0° (right)
  const cx = 60, cy = 52, r = 44;
  // Angle: 0 → π (left), 100 → 0 (right)
  const angle = Math.PI - (value / 100) * Math.PI;
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy - r * Math.sin(angle);

  // Arc segments for gradient effect (5 colored segments)
  const segments = [
    { start: 0, end: 20, color: '#ef4444' },   // red
    { start: 20, end: 40, color: '#f97316' },   // orange
    { start: 40, end: 60, color: '#eab308' },   // yellow
    { start: 60, end: 80, color: '#22c55e' },   // green
    { start: 80, end: 100, color: '#10b981' },  // emerald
  ];

  return (
    <svg viewBox="0 0 120 62" className="w-full" style={{ maxWidth: '160px' }}>
      {/* Background track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Colored segments */}
      {segments.map((seg) => {
        const a1 = Math.PI - (seg.start / 100) * Math.PI;
        const a2 = Math.PI - (seg.end / 100) * Math.PI;
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy - r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2);
        const y2 = cy - r * Math.sin(a2);
        return (
          <path
            key={seg.start}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
            fill="none"
            stroke={seg.color}
            strokeWidth="7"
            strokeLinecap="butt"
            opacity={0.35}
          />
        );
      })}
      {/* Active arc (filled up to value) */}
      {value > 0 && (() => {
        const activeAngle = Math.PI - (value / 100) * Math.PI;
        const x1 = cx - r; // start at left (180°)
        const y1 = cy;
        const x2 = cx + r * Math.cos(activeAngle);
        const y2 = cy - r * Math.sin(activeAngle);
        const largeArc = value > 50 ? 1 : 0;
        const label = getLabel(value);
        return (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={FILL_COLORS[label]}
            strokeWidth="7"
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })()}
      {/* Needle dot */}
      <circle cx={needleX} cy={needleY} r="4" fill="white" />
      <circle cx={needleX} cy={needleY} r="6" fill="white" opacity={0.15} />
    </svg>
  );
}

export default function FearGreedWidget() {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/fear-greed');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setValue(data.value ?? data.fgi?.now?.value ?? null);
      } catch (err) { console.error('[FearGreed] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (value === null) return <WidgetSkeleton variant="stat" />;

  const label = getLabel(value);
  const color = COLORS[label] || 'text-neutral-400';

  return (
    <div className="flex flex-col items-center">
      <GaugeArc value={value} />
      <div className="flex items-baseline gap-2 -mt-1">
        <AnimatedValue value={value} format={(v) => String(v)} className="text-2xl font-bold text-white" />
        <span className={`text-[10px] font-medium ${color}`}>{label}</span>
      </div>
    </div>
  );
}
