// Logo — InfoHub wordmark with solid-orange "Hub" tag (no gradient, no icon)
const SIZES = {
  xs: { text: 11, px: 3, py: 1, rx: 3 },
  sm: { text: 13, px: 4, py: 2, rx: 4 },
  md: { text: 15, px: 5, py: 3, rx: 5 },
  lg: { text: 20, px: 6, py: 3, rx: 6 },
  xl: { text: 26, px: 8, py: 4, rx: 7 },
};

function Logo({ size = 'md', inverted = false, className = '' }) {
  const d = SIZES[size];
  const ink = inverted ? '#0a0a0a' : 'var(--fg-default)';
  const tagBg = inverted ? '#0a0a0a' : '#FF9500';
  const tagFg = inverted ? '#FF9500' : '#0a0a0a';
  return (
    <div className={`ih-logo ${className}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: d.text, lineHeight: 1,
        letterSpacing: '-0.035em', color: ink,
      }}>Info</span>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: d.text, lineHeight: 1,
        letterSpacing: '-0.035em', color: tagFg, marginLeft: 1,
        background: tagBg,
        padding: `${d.py}px ${d.px}px`, borderRadius: d.rx,
      }}>Hub</span>
    </div>
  );
}

window.Logo = Logo;
