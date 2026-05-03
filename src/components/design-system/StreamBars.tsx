// v4 StreamBars — animated equalizer
interface StreamBarsProps { color?: string; height?: number; bars?: number; className?: string; }

export default function StreamBars({ color = 'var(--pump-mild)', height = 14, bars = 4, className }: StreamBarsProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height, flexShrink: 0 }} aria-hidden="true">
      {[...Array(bars)].map((_, i) => (
        <span key={i} style={{ width: 2, background: color, borderRadius: 1, animation: `stream-bar 1s ease-in-out ${i * 0.12}s infinite`, transformOrigin: 'bottom', boxShadow: `0 0 4px ${color}`, height: '60%' }} />
      ))}
    </span>
  );
}
