// v4 SatPing — satellite signal cone
interface SatPingProps { size?: number; color?: string; className?: string; }

export default function SatPing({ size = 13, color = 'var(--hub-accent)', className }: SatPingProps) {
  return (
    <span className={className} style={{ display: 'inline-block', width: size, height: size, position: 'relative', flexShrink: 0 }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="8" cy="12" r="1.6" fill={color} />
        <path d="M 8 12 L 4 3 A 5 5 0 0 1 12 3 Z" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5" />
        <path d="M 8 12 L 6 6 A 2.5 2.5 0 0 1 10 6 Z" fill={color} opacity="0.85">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" />
        </path>
      </svg>
    </span>
  );
}
