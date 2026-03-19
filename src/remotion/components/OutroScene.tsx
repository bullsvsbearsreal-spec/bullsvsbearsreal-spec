import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors, fullScreen } from './styles';
import { Background } from './Background';
import { InfoHubIcon, InfoHubLogo } from './Logo';

export const OutroScene: React.FC<{ totalExchanges: number }> = ({ totalExchanges }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const logoOp = interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textOp = interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const urlOp = interpolate(frame, [24, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tagOp = interpolate(frame, [32, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={fullScreen}>
      <Background />
      <div style={{
        position: 'relative', zIndex: 1, padding: '80px 48px',
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>

        {/* Icon */}
        <div style={{
          transform: `scale(${iconScale})`,
          marginBottom: 36,
          filter: `drop-shadow(0 0 40px ${colors.accent}40)`,
        }}>
          <InfoHubIcon size={140} />
        </div>

        {/* Logo text */}
        <div style={{ opacity: logoOp, marginBottom: 12 }}>
          <InfoHubLogo size={64} />
        </div>

        {/* Subtitle */}
        <p style={{
          opacity: textOp,
          fontSize: 26, color: colors.textSecondary, textAlign: 'center', marginTop: 8,
        }}>
          Real-time crypto intelligence across {totalExchanges} exchanges
        </p>

        {/* URL */}
        <div style={{
          opacity: urlOp, marginTop: 48,
          padding: '16px 40px', borderRadius: 16,
          background: `${colors.accent}15`,
          border: `1px solid ${colors.accent}30`,
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: colors.accent }}>
            info-hub.io
          </span>
        </div>

        {/* Tagline */}
        <p style={{
          opacity: tagOp, marginTop: 48,
          fontSize: 22, color: colors.textMuted, textAlign: 'center',
          maxWidth: 600, lineHeight: 1.6,
        }}>
          Funding rates · Open interest · Arbitrage<br />
          Options · ETFs · Liquidations
        </p>
      </div>
    </div>
  );
};
