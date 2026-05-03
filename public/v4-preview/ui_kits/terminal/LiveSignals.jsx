// LiveSignals — animated "alive" indicators used across the terminal chrome

// Radar pulse — concentric rings expanding outward from a core dot
function RadarPulse({ size = 14, color = 'var(--pump-mild)', ringCount = 2 }) {
  const core = size * 0.38;
  return (
    <span style={{
      position: 'relative', display: 'inline-block',
      width: size, height: size, flexShrink: 0,
    }}>
      {[...Array(ringCount)].map((_, i) => (
        <span key={i} style={{
          position: 'absolute', inset: 0,
          borderRadius: 999,
          border: `1px solid ${color}`,
          animation: `radar-ring 2.2s cubic-bezier(0, 0, 0.2, 1) ${i * 1.1}s infinite`,
          opacity: 0,
        }}/>
      ))}
      <span style={{
        position: 'absolute', top: '50%', left: '50%',
        width: core, height: core, marginLeft: -core/2, marginTop: -core/2,
        background: color, borderRadius: 999,
        boxShadow: `0 0 ${size * 0.6}px ${color}`,
        animation: 'radar-core 1.8s ease-in-out infinite',
      }}/>
    </span>
  );
}

// Data-flow bars — animated equalizer showing stream throughput
function StreamBars({ color = 'var(--pump-mild)', height = 14, bars = 4 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'flex-end', gap: 2,
      height, flexShrink: 0,
    }}>
      {[...Array(bars)].map((_, i) => (
        <span key={i} style={{
          width: 2, background: color, borderRadius: 1,
          animation: `stream-bar 1s ease-in-out ${i * 0.12}s infinite`,
          transformOrigin: 'bottom',
          boxShadow: `0 0 4px ${color}`,
        }}/>
      ))}
    </span>
  );
}

// Satellite ping — angled signal-cone icon with animated arcs (used for "broadcasting")
function SatPing({ size = 13, color = 'var(--hub-accent)' }) {
  return (
    <span style={{ display: 'inline-block', width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="8" cy="12" r="1.6" fill={color}/>
        <path d="M 8 12 L 4 3 A 5 5 0 0 1 12 3 Z" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5"/>
        <path d="M 8 12 L 6 6 A 2.5 2.5 0 0 1 10 6 Z" fill={color} opacity="0.85">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite"/>
        </path>
      </svg>
    </span>
  );
}

// Throughput counter — live-incrementing messages/sec
function ThroughputCounter({ baseline = 1247 }) {
  const [v, setV] = React.useState(baseline);
  React.useEffect(() => {
    const id = setInterval(() => {
      setV(baseline + Math.floor(Math.random() * 180 - 40));
    }, 420);
    return () => clearInterval(id);
  }, [baseline]);
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-default)',
      fontVariantNumeric: 'tabular-nums', fontWeight: 600, letterSpacing: '0.01em',
    }}>{v.toLocaleString()}</span>
  );
}

// Latency needle — animated value that hunts around a baseline
function LatencyGauge({ label, base, spread = 12, color = 'var(--pump-mild)' }) {
  const [v, setV] = React.useState(base);
  React.useEffect(() => {
    const id = setInterval(() => {
      setV(base + Math.floor(Math.random() * spread * 2 - spread));
    }, 750);
    return () => clearInterval(id);
  }, [base, spread]);
  // color graded by latency band
  const bad = v > base + spread * 0.7;
  const warn = v > base + spread * 0.3;
  const c = bad ? 'var(--rekt-mild)' : warn ? 'var(--hub-accent)' : color;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <span style={{
        color: c, fontVariantNumeric: 'tabular-nums', fontWeight: 600,
        transition: 'color 220ms',
      }}>{v}ms</span>
    </span>
  );
}

const LIVE_KEYFRAMES = `
  @keyframes radar-ring {
    0%   { transform: scale(0.4); opacity: 0.9; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes radar-core {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.18); }
  }
  @keyframes stream-bar {
    0%, 100% { height: 30%; }
    50%      { height: 100%; }
  }
  @keyframes exch-heartbeat {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
    50%      { box-shadow: 0 0 0 3px rgba(74,222,128,0); }
  }
  @keyframes exch-pop {
    0%   { transform: scale(1); filter: brightness(1); }
    15%  { transform: scale(1.12); filter: brightness(1.4); }
    100% { transform: scale(1); filter: brightness(1); }
  }
  @keyframes tape-ticker-flash {
    0%   { color: var(--pump-strong); }
    100% { color: var(--fg-default); }
  }
`;

window.RadarPulse = RadarPulse;
window.StreamBars = StreamBars;
window.SatPing = SatPing;
window.ThroughputCounter = ThroughputCounter;
window.LatencyGauge = LatencyGauge;
window.LIVE_KEYFRAMES = LIVE_KEYFRAMES;
