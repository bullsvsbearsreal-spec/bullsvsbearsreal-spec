// v5 BrandMark — "Info" + glowing orange "Hub" text, matching the
// circuit-board logo (replaced the older black-on-orange pill).
const SIZES = {
  xs: { text: 11 },
  sm: { text: 13 },
  md: { text: 15 },
  lg: { text: 20 },
  xl: { text: 26 },
} as const;

interface BrandMarkProps { size?: keyof typeof SIZES; className?: string; }

export default function BrandMark({ size = 'md', className }: BrandMarkProps) {
  const d = SIZES[size];
  const base = { fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: d.text, lineHeight: 1, letterSpacing: '-0.035em' } as const;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ ...base, color: 'var(--fg-default)' }}>Info</span>
      {/* Solid orange (not a bg-clip gradient) so it never renders invisible
          where background-clip is unsupported — this mark ships site-wide. */}
      <span style={{ ...base, color: '#FF9500', marginLeft: 1, textShadow: '0 0 16px rgba(255,140,0,0.45)' }}>Hub</span>
    </span>
  );
}
