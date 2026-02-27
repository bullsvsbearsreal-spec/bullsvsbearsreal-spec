'use client';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Sparkline({ data, color = '#fbbf24' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="mt-1">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Props {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  raw?: boolean;
  trend?: number[];
  trendColor?: string;
}

export default function StatCardWithSparkline({ icon, label, value, sub, raw, trend, trendColor }: Props) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-neutral-500 text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-white tabular-nums">
            {raw ? value : formatNumber(value as number)}
          </p>
          {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
        </div>
        {trend && trend.length >= 2 && (
          <Sparkline data={trend} color={trendColor} />
        )}
      </div>
    </div>
  );
}
