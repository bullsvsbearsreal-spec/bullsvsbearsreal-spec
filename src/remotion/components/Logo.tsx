import React from 'react';

interface LogoProps {
  size?: number; // font-size scale (default 48)
}

/**
 * InfoHub logo matching the real brand:
 * "Info" in white + "Hub" in black on gold gradient badge
 * Matches src/components/Logo.tsx visual identity
 */
export const InfoHubLogo: React.FC<LogoProps> = ({ size = 48 }) => {
  const badgePx = Math.round(size * 0.14);
  const badgeRx = Math.round(size * 0.1);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
    }}>
      <span style={{
        fontSize: size,
        fontWeight: 900,
        color: '#FFFFFF',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        letterSpacing: -1,
        lineHeight: 1,
      }}>
        Info
      </span>
      <span style={{
        fontSize: size,
        fontWeight: 900,
        color: '#000000',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        letterSpacing: -1,
        lineHeight: 1,
        background: 'linear-gradient(135deg, #FFB800, #FF8C00, #E06600)',
        padding: `${badgePx}px ${Math.round(badgePx * 1.4)}px`,
        borderRadius: badgeRx,
        marginLeft: 2,
      }}>
        Hub
      </span>
    </div>
  );
};

/**
 * InfoHub icon logo — the "IH" monogram from logo-icon.svg
 * Gold gradient "I" and "H" letterforms on dark background
 */
export const InfoHubIcon: React.FC<{ size?: number }> = ({ size = 80 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="ihGrad" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE680"/>
          <stop offset="0.2" stopColor="#FFD700"/>
          <stop offset="0.5" stopColor="#FFA500"/>
          <stop offset="0.8" stopColor="#FF7700"/>
          <stop offset="1" stopColor="#CC5500"/>
        </linearGradient>
        <linearGradient id="ihBg" x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#151515"/>
          <stop offset="1" stopColor="#0A0A0A"/>
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="4" fill="url(#ihBg)"/>
      <rect x="1.5" y="1.5" width="37" height="37" rx="3.5" stroke="#FF7700" strokeWidth="0.3" strokeOpacity="0.25" fill="none"/>
      {/* I letterform */}
      <path d="M6 9.5 L13 9.5 L13 10.2 L11.2 10.8 L11.2 28.2 L13 28.8 L13 29.5 L6 29.5 L6 28.8 L7.8 28.2 L7.8 10.8 L6 10.2 Z" fill="url(#ihGrad)"/>
      {/* H letterform */}
      <path d="M15.5 9.5 L21.5 9.5 L21.5 10.2 L20 10.8 L20 18.8 L29.5 18.8 L29.5 10.8 L28 10.2 L28 9.5 L34 9.5 L34 10.2 L32.5 10.8 L32.5 28.2 L34 28.8 L34 29.5 L28 29.5 L28 28.8 L29.5 28.2 L29.5 20.5 L20 20.5 L20 28.2 L21.5 28.8 L21.5 29.5 L15.5 29.5 L15.5 28.8 L17 28.2 L17 10.8 L15.5 10.2 Z" fill="url(#ihGrad)"/>
      {/* Bottom accent line */}
      <rect x="5" y="32" width="30" height="0.7" rx="0.35" fill="url(#ihGrad)" opacity="0.6"/>
    </svg>
  );
};
