import type { ReactNode } from 'react';

interface TerminalPageTitleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  /** Optional accent color used for a leading bar on the title (defaults to the hub accent token). */
  accent?: string;
}

export default function TerminalPageTitle({ title, subtitle, right, className, accent }: TerminalPageTitleProps) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
      <h1 style={{
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--fg-default)',
        margin: 0,
        position: 'relative',
        paddingLeft: accent ? 12 : 0,
      }}>
        {accent && (
          <span aria-hidden style={{
            position: 'absolute',
            left: 0, top: '50%',
            transform: 'translateY(-50%)',
            width: 4, height: '0.85em',
            background: accent,
            borderRadius: 2,
            boxShadow: `0 0 8px ${accent}55`,
          }} />
        )}
        {title}
      </h1>
      {subtitle && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{subtitle}</span>
      )}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}
