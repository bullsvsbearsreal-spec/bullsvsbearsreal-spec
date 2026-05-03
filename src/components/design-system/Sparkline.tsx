// v4 Sparkline
interface SparklineProps { data: number[]; color?: string; height?: number; fill?: boolean; strokeWidth?: number; className?: string; }

export default function Sparkline({ data, color = 'var(--hub-accent)', height = 28, fill = true, strokeWidth = 1.5, className }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h * 0.85 - 2}`).join(' ');
  return (
    <svg className={className} width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {fill && <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.15" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
