// v4 RadarPulse — pulsing live indicator
interface RadarPulseProps { size?: number; color?: string; ringCount?: number; className?: string; }

export default function RadarPulse({ size = 14, color = 'var(--pump-mild)', ringCount = 2, className }: RadarPulseProps) {
  const core = size * 0.38;
  return (
    <span className={className} style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      {[...Array(ringCount)].map((_, i) => (
        <span key={i} style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `1px solid ${color}`, animation: `radar-ring 2.2s cubic-bezier(0,0,0.2,1) ${i * 1.1}s infinite`, opacity: 0 }} />
      ))}
      <span style={{ position: 'absolute', top: '50%', left: '50%', width: core, height: core, marginLeft: -core / 2, marginTop: -core / 2, background: color, borderRadius: 999, boxShadow: `0 0 ${size * 0.6}px ${color}`, animation: 'radar-core 1.8s ease-in-out infinite' }} />
    </span>
  );
}
