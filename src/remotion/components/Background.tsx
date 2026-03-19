import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { colors, VIDEO_WIDTH, VIDEO_HEIGHT } from './styles';

/** Animated dark background with subtle grid and floating particles */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle grid drift
  const gridOffset = interpolate(frame, [0, 300], [0, 40], {
    extrapolateRight: 'extend',
  });

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      background: `radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, ${colors.bg} 60%)`,
    }}>
      {/* Grid pattern */}
      <svg width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{
        position: 'absolute', opacity: 0.04,
        transform: `translateY(${gridOffset % 60}px)`,
      }}>
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="110%" fill="url(#grid)" />
      </svg>

      {/* Accent glow at top */}
      <div style={{
        position: 'absolute',
        top: -200,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${colors.accent}15 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />

      {/* Bottom glow */}
      <div style={{
        position: 'absolute',
        bottom: -300,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 800,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${colors.blue}10 0%, transparent 70%)`,
        filter: 'blur(80px)',
      }} />
    </div>
  );
};
