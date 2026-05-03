// v4 BrandMark — "Info" + orange "Hub" pill
const SIZES = {
  xs: { text: 11, px: 3, py: 1, rx: 3 },
  sm: { text: 13, px: 4, py: 2, rx: 4 },
  md: { text: 15, px: 5, py: 3, rx: 5 },
  lg: { text: 20, px: 6, py: 3, rx: 6 },
  xl: { text: 26, px: 8, py: 4, rx: 7 },
} as const;

interface BrandMarkProps { size?: keyof typeof SIZES; className?: string; }

export default function BrandMark({ size = 'md', className }: BrandMarkProps) {
  const d = SIZES[size];
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: d.text, lineHeight: 1, letterSpacing: '-0.035em', color: 'var(--fg-default)' }}>Info</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: d.text, lineHeight: 1, letterSpacing: '-0.035em', color: '#0a0a0a', marginLeft: 1, background: '#FF9500', padding: `${d.py}px ${d.px}px`, borderRadius: d.rx }}>Hub</span>
    </span>
  );
}
